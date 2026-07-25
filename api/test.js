const http = require("http");

const BASE = process.env.TEST_URL || "http://localhost:3000";
let passed = 0;
let failed = 0;

async function request(method, path, opts = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const headers = { ...opts.headers };
    if (opts.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers,
        timeout: opts.timeout || 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const contentType = res.headers["content-type"] || "";
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: contentType.includes("application/json")
              ? JSON.parse(data)
              : data,
          });
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Request timed out"));
    });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}: ${err.message}`);
  }
}

async function run() {
  console.log(`\nPDFPing Smoke Tests (${BASE})\n`);

  await test("GET /health returns ok", async () => {
    const res = await request("GET", "/health");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.status !== "ok") throw new Error("Expected status ok");
  });

  await test("GET /api/v1/config returns config", async () => {
    const res = await request("GET", "/api/v1/config");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.supabaseUrl) throw new Error("Missing supabaseUrl");
  });

  await test("GET / serves landing page", async () => {
    const res = await request("GET", "/");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.includes("PDFPing")) throw new Error("Missing PDFPing title");
  });

  await test("GET /docs serves docs page", async () => {
    const res = await request("GET", "/docs");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (!res.body.includes("API Reference"))
      throw new Error("Missing API Reference title");
  });

  await test("POST /api/v1/convert/public with HTML returns PDF", async () => {
    const res = await request(
      "POST",
      "/api/v1/convert/public",
      {
        body: JSON.stringify({ html: "<h1>Test</h1>" }),
        timeout: 45000,
      },
    );
    if (res.status !== 200) {
      const detail =
        typeof res.body === "object" ? JSON.stringify(res.body) : res.body;
      throw new Error(`Expected 200, got ${res.status}: ${detail}`);
    }
    if (!res.headers["content-type"]?.includes("pdf"))
      throw new Error("Response is not a PDF");
  });

  await test("POST /api/v1/convert/public with empty body returns 400", async () => {
    const res = await request("POST", "/api/v1/convert/public", {
      body: JSON.stringify({}),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
  });

  await test("POST /api/v1/convert without auth returns 401", async () => {
    const res = await request("POST", "/api/v1/convert", {
      body: JSON.stringify({ html: "<h1>Test</h1>" }),
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  await test("POST /api/v1/convert with bad auth returns 403", async () => {
    const res = await request("POST", "/api/v1/convert", {
      headers: { Authorization: "Bearer bad_key" },
      body: JSON.stringify({ html: "<h1>Test</h1>" }),
    });
    if (res.status !== 403) throw new Error(`Expected 403, got ${res.status}`);
  });

  await test("POST malformed JSON returns 400", async () => {
    const res = await request("POST", "/api/v1/convert/public", {
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (typeof res.body === "object" && res.body.error !== "Invalid JSON in request body")
      throw new Error("Should return clean JSON error, not HTML");
  });

  await test("POST /api/v1/keys without email returns 400", async () => {
    const res = await request("POST", "/api/v1/keys", {
      body: JSON.stringify({}),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (res.body.error !== "Email is required")
      throw new Error("Wrong error message");
  });

  await test("POST /api/v1/keys with email returns key", async () => {
    const res = await request("POST", "/api/v1/keys", {
      body: JSON.stringify({ email: "test@example.com" }),
    });
    if (res.status !== 200) {
      const detail = JSON.stringify(res.body);
      throw new Error(`Expected 200, got ${res.status}: ${detail}`);
    }
    if (!res.body.api_key?.startsWith("pdfping_"))
      throw new Error("API key should start with pdfping_");
  });

  await test("HTML payload > 1MB returns 413", async () => {
    const bigHtml = "<p>" + "x".repeat(2 * 1024 * 1024) + "</p>";
    const res = await request("POST", "/api/v1/convert/public", {
      body: JSON.stringify({ html: bigHtml }),
    });
    if (res.status !== 413) throw new Error(`Expected 413, got ${res.status}`);
  });

  await test("Invalid URL returns 400", async () => {
    const res = await request("POST", "/api/v1/convert/public", {
      body: JSON.stringify({ url: "not-a-url" }),
    });
    if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    if (!res.body.error?.includes("Invalid URL"))
      throw new Error("Should indicate invalid URL");
  });

  await test("GET /api/v1/auth/me without auth returns null user", async () => {
    const res = await request("GET", "/api/v1/auth/me");
    if (res.status !== 200) throw new Error(`Expected 200, got ${res.status}`);
    if (res.body.user !== null) throw new Error("user should be null");
  });

  console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
