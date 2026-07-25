# PDFPing

Send HTML or a URL. Get a PDF back.

Built with Chromium via Playwright. One POST request, no queues, no SDK required.

[![Docs](https://img.shields.io/badge/docs-pdfapi.uhadev.com-6366f1)](https://pdfapi.uhadev.com/docs)
[![GitHub](https://img.shields.io/badge/github-Spyboss%2Fpdfping-181717)](https://github.com/Spyboss/pdfping)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## Quick Start

```bash
# With an API key (higher limits)
curl -X POST https://pdfapi.uhadev.com/api/v1/convert \
  -H "Authorization: Bearer pdfping_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "html": "<h1>Hello World</h1>" }' \
  -o output.pdf

# Or without a key (rate-limited)
curl -X POST https://pdfapi.uhadev.com/api/v1/convert/public \
  -H "Content-Type: application/json" \
  -d '{ "html": "<h1>Hello World</h1>" }' \
  -o output.pdf
```

Get a free key at [pdfapi.uhadev.com](https://pdfapi.uhadev.com).

## Documentation

| Resource | Description |
|---|---|
| [API Docs](https://pdfapi.uhadev.com/docs) | Full API reference with curl, JS, and Python examples |
| [OpenAPI Spec](api/openapi.yaml) | Machine-readable API specification (OpenAPI 3.0) |
| [Architecture](ARCHITECTURE.md) | System design and request lifecycle |
| [Benchmarks](BENCHMARKS.md) | Load test results and performance analysis |
| [Changelog](CHANGELOG.md) | Release notes and migration guides |

## Features

- **Full Chromium rendering** — CSS, fonts, images, everything renders as in a browser
- **One POST request** — Send HTML or a URL, get a PDF back
- **Usage dashboard** — Sign in to get an API key and track conversions
- **API key authentication** — Secure SHA-256 hashed keys
- **Rate limiting** — 50 conversions/day public, 10,000 per API key

## Stack

- **Express + Playwright** (Node.js)
- **Supabase** (auth, usage tracking, optional)
- **Docker + Railway** (hosting)

## Run Locally

```bash
cd api
cp .env.example .env
npm install
npm start
```

Requires Chromium on the host, or use Docker:

```bash
docker compose up --build
```

## Benchmarks

See [BENCHMARKS.md](BENCHMARKS.md) for full results:

| Concurrency | Requests | Success Rate | Avg Latency | P95 |
|---|---|---|---|---|
| 10 | 100 | 100% | 2,332 ms | 2,737 ms |
| 20 | 200 | 100% | 2,519 ms | 3,485 ms |
| 50 | 500 | 90.2% | 4,923 ms | 5,772 ms |

Zero browser crashes across all tests.

## License

MIT
