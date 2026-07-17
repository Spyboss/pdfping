# PDFPing — PDF Generation API

Pass HTML or a URL, get a PDF back. Powered by Chromium via Playwright.

## Quick Start

```bash
# Clone and install
cd api && npm install

# Create .env from template
cp .env.example .env

# Start locally
npm start
```

## Deployment

### Railway
```bash
railway login
railway init
railway up
```

### Render
Connect repo, set build command `docker build -t pdfping ./api`, start command `docker run -p 3000:3000 pdfping`.

## API

```
POST /api/v1/convert
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "html": "<h1>Hello</h1>",
  "options": {
    "format": "A4",
    "landscape": false,
    "margin": "10mm"
  }
}
```

## Pricing
- Free: 10 conversions/mo
- Pro: $9/mo — 500 conversions

## Stacks
- Express + Playwright (Node.js)
- Supabase (auth, usage tracking)
- Lemon Squeezy (payments)
- Docker + Railway/Render (hosting)
