require("dotenv").config();
const express = require("express");
const { chromium } = require("playwright");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const { WebSocket } = require("ws");
const { Mutex } = require("async-mutex");
const rateLimit = require("express-rate-limit");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const siteUrl = process.env.SITE_URL || "https://pdfapi.uhadev.com";
const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        realtime: { transport: WebSocket },
      })
    : null;

if (supabase) {
  console.log("Supabase connected");
  migrateOldKeys();
} else {
  console.log("Supabase not configured — using in-memory storage");
}

async function migrateOldKeys() {
  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, key, key_hash")
      .is("key_hash", null)
      .not("key", "is", null);
    if (error || !data || data.length === 0) return;
    console.log(`Migrating ${data.length} legacy keys to hashed format...`);
    for (const row of data) {
      const keyHash = hashApiKey(row.key);
      await supabase
        .from("api_keys")
        .update({ key_hash: keyHash })
        .eq("id", row.id);
    }
    console.log("Key migration complete");
  } catch (err) {
    console.error("Key migration error (non-fatal):", err.message);
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];

app.set("env", process.env.NODE_ENV || "production");
app.disable("x-powered-by");
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }),
);
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const MAX_HTML_SIZE = 1024 * 1024;
const MAX_URL_LENGTH = 2048;

function isValidUrl(str) {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

let browser;
let browserMutex = new Mutex();
let browserContextCount = 0;
const BROWSER_RECYCLE_AFTER = 500;
const BROWSER_IDLE_TIMEOUT = 60000;
let browserIdleTimer = null;

async function getBrowser() {
  return browserMutex.runExclusive(async () => {
    if (browser && browser.isConnected()) {
      if (browserIdleTimer) {
        clearTimeout(browserIdleTimer);
        browserIdleTimer = null;
      }
      return browser;
    }
    if (browser) {
      try {
        await browser.close();
      } catch {}
      browser = null;
    }
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--disable-gpu",
        "--disable-background-networking",
        "--disable-background-timer-throttling",
        "--disable-backgrounding-occluded-windows",
        "--disable-breakpad",
        "--disable-component-update",
        "--disable-extensions",
        "--disable-sync",
        "--no-first-run",
        "--no-default-browser-check",
        "--mute-audio",
        "--hide-scrollbars",
      ],
    });
    browserContextCount = 0;
    browser.on("disconnected", () => {
      browser = null;
    });
    return browser;
  });
}

function scheduleBrowserIdleShutdown() {
  if (browserIdleTimer) clearTimeout(browserIdleTimer);
  browserIdleTimer = setTimeout(async () => {
    await browserMutex.runExclusive(async () => {
      if (browser) {
        try {
          await browser.close();
        } catch {}
        browser = null;
      }
    });
  }, BROWSER_IDLE_TIMEOUT);
}

async function withBrowserPage(fn) {
  const b = await getBrowser();
  const context = await b.newContext();
  const page = await context.newPage();
  try {
    browserContextCount++;
    const result = await fn(page);
    return result;
  } finally {
    await page.close();
    await context.close();
    if (browserContextCount >= BROWSER_RECYCLE_AFTER) {
      await browserMutex.runExclusive(async () => {
        if (browser && browser.isConnected()) {
          try {
            await browser.close();
          } catch {}
          browser = null;
          browserContextCount = 0;
        }
      });
    }
    scheduleBrowserIdleShutdown();
  }
}

function hashApiKey(key) {
  return crypto.createHash("sha256").update(key).digest("hex");
}

async function findApiKey(token) {
  if (supabase) {
    const keyHash = hashApiKey(token);
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("key_hash", keyHash)
      .maybeSingle();
    if (data && !error) return { ...data, key: token };

    const { data: dataOld, error: errorOld } = await supabase
      .from("api_keys")
      .select("*")
      .eq("key", token)
      .maybeSingle();
    if (errorOld || !dataOld) return null;
    return dataOld;
  }
  return apiKeys.get(token) || null;
}

async function incrementUsage(keyId) {
  if (supabase) {
    await supabase.rpc("increment", { api_key_id: keyId });
  } else {
    return; 
  }
}

async function logUsage(keyId, endpoint, status) {
  if (supabase && keyId) {
    try {
      await supabase.from("usage_logs").insert({
        api_key_id: keyId,
        endpoint,
        status,
      });
    } catch {}
  }
}

async function getUserFromToken(token) {
  if (!supabase || !token) return null;
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

async function getApiKeyForUser(userId) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}

async function ensureApiKeyForUser(user) {
  if (!supabase) return null;
  let key = await getApiKeyForUser(user.id);
  if (key) return key;

  const rawKey = "pdfping_" + crypto.randomBytes(24).toString("hex");
  const keyHash = hashApiKey(rawKey);
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      key_hash: keyHash,
      email: user.email,
      user_id: user.id,
      plan: "free",
      limit_count: 10000,
      used_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, key: rawKey };
}

const apiKeys = new Map();

async function loadKeysFromEnv() {
  if (process.env.API_KEYS) {
    process.env.API_KEYS.split(",").forEach((entry) => {
      const [token] = entry.split(":");
      if (token) {
        apiKeys.set(token.trim(), { used: 0 });
      }
    });
    console.log(
      `Loaded ${process.env.API_KEYS.split(",").length} API keys from env`,
    );
  } else {
    const defaultKey = "pdfping_" + crypto.randomBytes(16).toString("hex");
    apiKeys.set(defaultKey, { used: 0 });
    console.log(`No API_KEYS set. Generated test key: ${defaultKey}`);
  }
}
loadKeysFromEnv();

const keyGenLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many key requests. Try again in an hour." },
});

async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Missing API key. Use header: Authorization: Bearer <your_key>",
    });
  }
  const token = auth.slice(7);

  if (supabase) {
    const key = await findApiKey(token);
    if (!key) {
      return res.status(403).json({
        error: "Invalid API key. Get one at https://pdfapi.uhadev.com",
      });
    }
    req.apiKey = key;
    req.apiKeyToken = token;
    return next();
  }

  const key = apiKeys.get(token);
  if (!key) {
    return res
      .status(403)
      .json({ error: "Invalid API key. Get one at https://pdfapi.uhadev.com" });
  }
  req.apiKey = key;
  req.apiKeyToken = token;
  next();
}

async function renderPdf(html, url, options = {}) {
  const {
    format = "A4",
    landscape = false,
    printBackground = true,
    wait = 1,
    margin = "0mm",
  } = options;

  return withBrowserPage(async (page) => {
    await page.setViewportSize({ width: 794, height: 1123 });
    if (url) {
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    } else {
      await page.setContent(html, { waitUntil: "networkidle" });
    }
    if (wait > 0) await page.waitForTimeout(wait * 1000);
    return await page.pdf({
      format,
      landscape,
      printBackground,
      margin: { top: margin, right: margin, bottom: margin, left: margin },
    });
  });
}

app.post("/api/v1/convert", authenticate, async (req, res) => {
  const { html, url, options = {} } = req.body;
  if (!html && !url) {
    return res.status(400).json({
      error: 'Provide "html" (string) or "url" (string) in the request body',
    });
  }

  if (html && html.length > MAX_HTML_SIZE) {
    return res.status(413).json({ error: "HTML payload too large (max 1MB)" });
  }
  if (url) {
    if (typeof url !== "string" || url.length > MAX_URL_LENGTH) {
      return res.status(400).json({ error: "URL too long or invalid" });
    }
    if (!isValidUrl(url)) {
      return res.status(400).json({
        error: "Invalid URL. Must be a valid http:// or https:// URL.",
      });
    }
  }

  try {
    const pdf = await renderPdf(html, url, options);
    const keyId = supabase ? req.apiKey.id : null;
    await incrementUsage(keyId);
    await logUsage(keyId, "/api/v1/convert", 200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="output.pdf"');
    res.send(pdf);
  } catch (err) {
    await logUsage(
      supabase ? req.apiKey.id : null,
      "/api/v1/convert",
      500,
    );
    console.error("Conversion failed:", err.message);
    res.status(500).json({ error: "Conversion failed" });
  }
});

app.get("/api/v1/usage", authenticate, async (req, res) => {
  if (supabase) {
    const { data } = await supabase
      .from("api_keys")
      .select("used_count, limit_count")
      .eq("id", req.apiKey.id)
      .single();
    if (data) {
      return res.json({
        used: data.used_count,
        limit: data.limit_count,
        remaining: data.limit_count - data.used_count,
      });
    }
  }
  res.json({
    used: req.apiKey.used || 0,
    remaining: Infinity,
  });
});

const PUBLIC_LIMIT = 50;

const publicConvertLimiter = rateLimit({
  windowMs: 86400000,
  max: PUBLIC_LIMIT,
  validate: { xForwardedForHeader: false },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return (
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      req.ip ||
      "unknown"
    );
  },
  message: {
    error: `Free limit reached (${PUBLIC_LIMIT} conversions/day per IP). Get a free API key for higher limits.`,
  },
});

app.post(
  "/api/v1/convert/public",
  publicConvertLimiter,
  async (req, res) => {
    const { html, url, options = {} } = req.body;
    if (!html && !url) {
      return res.status(400).json({ error: "Provide html or url" });
    }

    if (html && html.length > MAX_HTML_SIZE) {
      return res.status(413).json({ error: "HTML payload too large (max 1MB)" });
    }
    if (url) {
      if (typeof url !== "string" || url.length > MAX_URL_LENGTH) {
        return res.status(400).json({ error: "URL too long or invalid" });
      }
      if (!isValidUrl(url)) {
        return res.status(400).json({
          error: "Invalid URL. Must be a valid http:// or https:// URL.",
        });
      }
    }

    try {
      const pdf = await renderPdf(html, url, { wait: 1 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'inline; filename="output.pdf"');
      res.send(pdf);
    } catch (err) {
      console.error("Public conversion failed:", err.message);
      res.status(500).json({ error: "Conversion failed" });
    }
  },
);

app.get("/docs", (req, res) => {
  res.sendFile(path.join(__dirname, "../landing/docs.html"));
});

app.use(express.static(path.join(__dirname, "../landing")));
app.use(express.static(path.join(__dirname, "..")));

const keyGenMutex = new Mutex();

app.post("/api/v1/keys", keyGenLimiter, async (req, res) => {
  const { email, regenerate } = req.body;

  const auth = req.headers.authorization;
  let user = null;
  if (auth && auth.startsWith("Bearer ")) {
    user = await getUserFromToken(auth.slice(7));
  }

  if (regenerate) {
    if (!user)
      return res.status(401).json({ error: "Authentication required" });
    return keyGenMutex.runExclusive(async () => {
      const existing = await getApiKeyForUser(user.id);
      if (!existing)
        return res.status(404).json({ error: "No existing key found" });
      const newToken = "pdfping_" + crypto.randomBytes(24).toString("hex");
      const newHash = hashApiKey(newToken);
      await supabase
        .from("api_keys")
        .update({ key_hash: newHash })
        .eq("id", existing.id);
      console.log(`API key regenerated for ${user.email}`);
      return res.json({ api_key: newToken });
    });
  }

  if (!email) return res.status(400).json({ error: "Email is required" });

  if (typeof email !== "string" || email.length > 254 || !email.includes("@")) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  return keyGenMutex.runExclusive(async () => {
    const rawKey = "pdfping_" + crypto.randomBytes(24).toString("hex");
    const keyHash = hashApiKey(rawKey);

    if (supabase) {
      const insertData = {
        key_hash: keyHash,
        email,
        plan: "free",
        limit_count: 10000,
        used_count: 0,
      };
      if (user) insertData.user_id = user.id;

      const { error } = await supabase.from("api_keys").insert(insertData);
      if (error) {
        if (error.code === "23505") {
          return res.status(409).json({ error: "Key already exists" });
        }
        return res.status(500).json({ error: "Failed to create key" });
      }
    }

    apiKeys.set(rawKey, { used: 0, email });
    console.log(`New API key generated for ${email}: ${rawKey}`);
    res.json({
      api_key: rawKey,
      message: "Store this key securely. It will not be shown again.",
    });
  });
});

app.get("/api/v1/config", (req, res) => {
  res.json({
    supabaseUrl,
    anonKey: supabaseAnonKey,
    siteUrl,
  });
});

app.get("/api/v1/auth/me", async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.json({ user: null });
  }
  const user = await getUserFromToken(auth.slice(7));
  if (!user) return res.json({ user: null });

  try {
    const apiKey = await ensureApiKeyForUser(user);
    if (!apiKey) return res.json({ user: null });
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name:
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        avatar: user.user_metadata?.avatar_url,
      },
      api_key: apiKey.key,
      used: apiKey.used_count || 0,
      limit: apiKey.limit_count || 10000,
      remaining: (apiKey.limit_count || 10000) - (apiKey.used_count || 0),
    });
  } catch (err) {
    console.error("Auth/me error:", err.message);
    res.status(500).json({ error: "Failed to fetch user data" });
  }
});

app.get("/health", (req, res) =>
  res.json({ status: "ok", version: "1.0.0" }),
);

app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON in request body" });
  }
  console.error("Unhandled error:", err.message);
  res.status(err.status || 500).json({
    error: "Internal server error",
  });
});

process.on("SIGINT", async () => {
  await browserMutex.runExclusive(async () => {
    if (browser) {
      try {
        await browser.close();
      } catch {}
      browser = null;
    }
  });
  process.exit();
});

process.on("SIGTERM", async () => {
  await browserMutex.runExclusive(async () => {
    if (browser) {
      try {
        await browser.close();
      } catch {}
      browser = null;
    }
  });
  process.exit();
});

app.listen(PORT, () => {
  console.log(`PDFPing API running on port ${PORT}`);
});
