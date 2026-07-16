require('dotenv').config();
const express = require('express');
const { chromium } = require('playwright');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];

let browser;

async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process']
    });
  }
  return browser;
}

app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const apiKeys = new Map();
const usage = new Map();

const PLAN_LIMITS = { free: 10, pro: 500, business: 5000 };

async function loadKeysFromEnv() {
  if (process.env.API_KEYS) {
    process.env.API_KEYS.split(',').forEach(key => {
      const [token, plan = 'free'] = key.split(':');
      if (token) {
        apiKeys.set(token.trim(), { plan: plan.trim(), limit: PLAN_LIMITS[plan.trim()] || 10, used: 0 });
      }
    });
    console.log(`Loaded ${process.env.API_KEYS.split(',').length} API keys from env`);
  } else {
    const defaultKey = crypto.randomBytes(16).toString('hex');
    apiKeys.set(defaultKey, { plan: 'free', limit: 10, used: 0 });
    console.log(`No API_KEYS set. Generated test key: ${defaultKey}`);
  }
}
loadKeysFromEnv();

async function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing API key. Use header: Authorization: Bearer <your_key>' });
  }
  const token = auth.slice(7);
  const key = apiKeys.get(token);
  if (!key) {
    return res.status(403).json({ error: 'Invalid API key. Get one at https://pdfping.dev' });
  }
  if (key.used >= key.limit) {
    return res.status(429).json({ error: `Monthly limit (${key.limit}) exceeded. Upgrade at https://pdfping.dev` });
  }
  req.apiKey = key;
  req.apiKeyToken = token;
  next();
}

app.post('/api/v1/convert', authenticate, async (req, res) => {
  const { html, url, options = {} } = req.body;

  if (!html && !url) {
    return res.status(400).json({ error: 'Provide "html" (string) or "url" (string) in the request body' });
  }

  const { format = 'A4', landscape = false, margin = '10mm', printBackground = true, wait = 2 } = options;

  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage();
    await page.setViewportSize({ width: 794, height: 1123 });

    if (url) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    } else {
      await page.setContent(html, { waitUntil: 'networkidle' });
    }

    if (wait > 0) await page.waitForTimeout(wait * 1000);

    const pdf = await page.pdf({
      format,
      landscape,
      printBackground,
      margin: { top: margin, right: margin, bottom: margin, left: margin }
    });

    req.apiKey.used++;
    usage.set(req.apiKeyToken, (usage.get(req.apiKeyToken) || 0) + 1);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="output.pdf"');
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ error: 'Conversion failed', detail: err.message });
  } finally {
    if (page) await page.close();
  }
});

app.get('/api/v1/usage', authenticate, (req, res) => {
  res.json({
    plan: req.apiKey.plan,
    limit: req.apiKey.limit,
    used: req.apiKey.used,
    remaining: req.apiKey.limit - req.apiKey.used
  });
});

app.use(express.static('../landing'));

app.post('/api/v1/keys', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const token = 'pdfping_' + crypto.randomBytes(24).toString('hex');
  apiKeys.set(token, { plan: 'free', limit: 10, used: 0, email });
  console.log(`New API key generated for ${email}: ${token}`);
  res.json({ api_key: token, plan: 'free', limit: 10, message: 'Check your usage at /dashboard?api_key=' + token });
});

app.get('/health', (req, res) => res.json({ status: 'ok', version: '1.0.0' }));

process.on('SIGINT', async () => {
  if (browser) await browser.close();
  process.exit();
});
process.on('SIGTERM', async () => {
  if (browser) await browser.close();
  process.exit();
});

app.listen(PORT, () => {
  console.log(`PDFPing API running on port ${PORT}`);
});
