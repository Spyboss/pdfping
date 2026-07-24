# PDFPing

Send HTML or a URL. Get a PDF back. Free.

Built with Chromium via Playwright. One POST request, no queues, no SDK.

## API

### With an API key (higher limits)

```bash
curl -X POST https://pdfapi.uhadev.com/api/v1/convert \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "html": "<h1>Hello World</h1>" }' \
  -o output.pdf
```

Get a free key at [pdfapi.uhadev.com](https://pdfapi.uhadev.com).

### No key needed (rate-limited)

```bash
curl -X POST https://pdfapi.uhadev.com/api/v1/convert/public \
  -H "Content-Type: application/json" \
  -d '{ "html": "<h1>Hello World</h1>" }' \
  -o output.pdf
```

50 conversions/day per IP.

### Options

```json
{
  "html": "<h1>Hello</h1>",
  "options": {
    "format": "A4",
    "landscape": false,
    "margin": "10mm"
  }
}
```

Accepts `html` or `url`. Options: `format`, `landscape`, `printBackground`, `margin`, `wait`.

## Run locally

```bash
cd api
cp .env.example .env
npm install
npm start
```

Requires Chromium. The Dockerfile handles this automatically.

## Stack

- **Express + Playwright** (Node.js)
- **Supabase** (auth, usage tracking, optional)
- **Docker + Railway** (hosting)

## License

MIT
