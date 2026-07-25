# PDFPing

[![Docs](https://img.shields.io/badge/docs-pdfapi.uhadev.com-6366f1)](https://pdfapi.uhadev.com/docs)
[![GitHub](https://img.shields.io/badge/github-Spyboss%2Fpdfping-181717)](https://github.com/Spyboss/pdfping)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

PDFPing converts HTML to PDF. It uses Chromium via Playwright for rendering.

```bash
curl -X POST https://pdfapi.uhadev.com/api/v1/convert \
  -H "Authorization: Bearer pdfping_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "html": "<h1>Hello World</h1>" }' \
  -o output.pdf
```

Keys at [pdfapi.uhadev.com](https://pdfapi.uhadev.com). No key needed for `/api/v1/convert/public` (50/day limit).

[docs](https://pdfapi.uhadev.com/docs) · [openapi.yaml](api/openapi.yaml) · [ARCHITECTURE.md](ARCHITECTURE.md) · [BENCHMARKS.md](BENCHMARKS.md) · [CHANGELOG.md](CHANGELOG.md)

Built with Express, Playwright, and Chromium. Supabase manages keys and usage tracking. You can run without it.

```bash
cd api
cp .env.example .env
npm install
npm start
```

```bash
docker compose up --build
```

| Concurrency | Requests | Success | Avg Latency | P95 |
|---|---|---|---|---|
| 10 | 100 | 100% | 2,332 ms | 2,737 ms |
| 20 | 200 | 100% | 2,519 ms | 3,485 ms |
| 50 | 500 | 90% | 4,923 ms | 5,772 ms |

Full results in [BENCHMARKS.md](BENCHMARKS.md).

MIT
