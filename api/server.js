require("dotenv").config();
const express = require("express");
const { chromium } = require("playwright");
const cors = require("cors");
const helmet = require("helmet");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");
const { WebSocket } = require("ws");

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
} else {
  console.log("Supabase not configured — using in-memory storage");
}

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(",") || ["*"];

app.use(
  helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }),
);
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

let browser;
let browserLaunching = false;

async function getBrowser() {
  if (browserLaunching) {
    await new Promise((r) => setTimeout(r, 500));
    return getBrowser();
  }
  if (browser && browser.isConnected()) return browser;
  browserLaunching = true;
  try {
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
      ],
    });
    browser.on("disconnected", () => {
      browser = null;
    });
    return browser;
  } finally {
    browserLaunching = false;
  }
}

async function findApiKey(token) {
  if (supabase) {
    const { data, error } = await supabase
      .from("api_keys")
      .select("*")
      .eq("key", token)
      .single();
    if (error || !data) return null;
    return data;
  }
  return apiKeys.get(token) || null;
}

async function incrementUsage(keyId, token) {
  if (supabase) {
    const { data, error } = await supabase
      .from("api_keys")
      .select("used_count")
      .eq("id", keyId)
      .single();
    if (data) {
      await supabase
        .from("api_keys")
        .update({ used_count: data.used_count + 1 })
        .eq("id", keyId);
    }
  } else {
    const key = apiKeys.get(token);
    if (key) key.used++;
  }
}

async function logUsage(keyId, endpoint, status) {
  if (supabase) {
    await supabase.from("usage_logs").insert({
      api_key_id: keyId,
      endpoint,
      status,
    });
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

async function ensureApiKeyForUser(user, email) {
  if (!supabase) return null;
  let key = await getApiKeyForUser(user.id);
  if (key) return key;

  const token = "pdfping_" + crypto.randomBytes(24).toString("hex");
  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      key: token,
      email: email || user.email,
      user_id: user.id,
      plan: "free",
      limit_count: 10000,
      used_count: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

const apiKeys = new Map();

async function loadKeysFromEnv() {
  if (process.env.API_KEYS) {
    process.env.API_KEYS.split(",").forEach((key) => {
      const [token] = key.split(":");
      if (token) {
        apiKeys.set(token.trim(), { used: 0 });
      }
    });
    console.log(
      `Loaded ${process.env.API_KEYS.split(",").length} API keys from env`,
    );
  } else {
    const defaultKey = crypto.randomBytes(16).toString("hex");
    apiKeys.set(defaultKey, { used: 0 });
    console.log(`No API_KEYS set. Generated test key: ${defaultKey}`);
  }
}
loadKeysFromEnv();

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

  const b = await getBrowser();
  const page = await b.newPage();
  try {
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
  } finally {
    await page.close();
  }
}

app.post("/api/v1/convert", authenticate, async (req, res) => {
  const { html, url, options = {} } = req.body;
  if (!html && !url) {
    return res.status(400).json({
      error: 'Provide "html" (string) or "url" (string) in the request body',
    });
  }

  try {
    const pdf = await renderPdf(html, url, options);
    const keyId = supabase ? req.apiKey.id : null;
    await incrementUsage(keyId, req.apiKeyToken);
    await logUsage(keyId, "/api/v1/convert", 200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="output.pdf"');
    res.send(pdf);
  } catch (err) {
    await logUsage(supabase ? req.apiKey.id : null, "/api/v1/convert", 500);
    res.status(500).json({ error: "Conversion failed", detail: err.message });
  }
});

app.get("/api/v1/usage", authenticate, async (req, res) => {
  if (supabase) {
    return res.json({
      used: req.apiKey.used_count,
      limit: req.apiKey.limit_count,
      remaining: req.apiKey.limit_count - req.apiKey.used_count,
    });
  }
  res.json({
    used: req.apiKey.used,
    remaining: Infinity,
  });
});

const publicLimits = new Map();
const PUBLIC_LIMIT = 50;

app.post("/api/v1/convert/public", async (req, res) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.ip ||
    "unknown";
  const count = publicLimits.get(ip) || 0;
  if (count >= PUBLIC_LIMIT) {
    return res.status(429).json({
      error: `Free limit reached (${PUBLIC_LIMIT} conversions/day per IP). Get a free API key for higher limits.`,
    });
  }
  publicLimits.set(ip, count + 1);
  setTimeout(() => {
    const cur = publicLimits.get(ip) || 1;
    publicLimits.set(ip, cur - 1);
  }, 86400000);

  const { html, url } = req.body;
  if (!html && !url)
    return res.status(400).json({ error: "Provide html or url" });

  try {
    const pdf = await renderPdf(html, url, { wait: 1 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'inline; filename="output.pdf"');
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: "Conversion failed", detail: err.message });
  }
});

app.use(express.static("../landing"));

app.post("/api/v1/keys", async (req, res) => {
  const { email, regenerate } = req.body;

  const auth = req.headers.authorization;
  let user = null;
  if (auth && auth.startsWith("Bearer ")) {
    user = await getUserFromToken(auth.slice(7));
  }

  if (regenerate) {
    if (!user)
      return res.status(401).json({ error: "Authentication required" });
    const existing = await getApiKeyForUser(user.id);
    if (!existing)
      return res.status(404).json({ error: "No existing key found" });
    const newToken = "pdfping_" + crypto.randomBytes(24).toString("hex");
    await supabase
      .from("api_keys")
      .update({ key: newToken })
      .eq("id", existing.id);
    console.log(`API key regenerated for ${user.email}`);
    return res.json({
      api_key: newToken,
    });
  }

  if (!email) return res.status(400).json({ error: "Email is required" });

  const token = "pdfping_" + crypto.randomBytes(24).toString("hex");

  if (supabase) {
    const insertData = {
      key: token,
      email,
      plan: "free",
      limit_count: 10000,
      used_count: 0,
    };
    if (user) insertData.user_id = user.id;
    const { error } = await supabase.from("api_keys").insert(insertData);
    if (error) return res.status(500).json({ error: error.message });
  }

  apiKeys.set(token, { used: 0, email });
  console.log(`New API key generated for ${email}: ${token}`);
  res.json({
    api_key: token,
    message: "Check your usage at /dashboard?api_key=" + token,
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
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name:
          user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
        avatar: user.user_metadata?.avatar_url,
      },
      api_key: apiKey.key,
      used: apiKey.used_count,
      limit: apiKey.limit_count,
      remaining: apiKey.limit_count - apiKey.used_count,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/health", (req, res) => res.json({ status: "ok", version: "1.0.0" }));

process.on("SIGINT", async () => {
  if (browser) await browser.close();
  process.exit();
});
process.on("SIGTERM", async () => {
  if (browser) await browser.close();
  process.exit();
});

app.listen(PORT, () => {
  console.log(`PDFPing API running on port ${PORT}`);
});
