I built a free PDF API because Sejda's free tier kept resetting my progress

https://pdfapi.uhadev.com

I was building an invoicing tool and needed PDFs from HTML. Every time I asked an LLM to write print CSS, I'd paste it into Sejda. Three conversions later I'd hit the limit and have to wait hours.

So I built my own API. One POST request, PDF comes back.

```
curl -X POST https://pdfapi.uhadev.com/api/v1/convert \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"html": "<h1>Invoice</h1>"}' \
  -o invoice.pdf
```

Real Chromium rendering. CSS, fonts, images — all of it works.

Public endpoint works without a key (50/day per IP). Sign up for a free dedicated key with higher limits — no credit card.

Express + Playwright, deployed on Railway. Open source on GitHub.

https://github.com/Spyboss/pdfping
