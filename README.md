# PDFPing — PDF Generation API

Turn HTML or URLs into PDFs with one API call. Uses real Chromium rendering.

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
Connect this repo, set build command to `docker build -t pdfping ./api` and start command to `docker run -p 3000:3000 pdfping`.

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
- Business: $29/mo — 5,000 conversions

## Stacks
- Express + Playwright (Node.js)
- Supabase (auth, usage tracking)
- Stripe (payments)
- Docker + Railway/Render (hosting)
