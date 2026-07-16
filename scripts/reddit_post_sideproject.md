# Post this to r/SideProject at https://new.reddit.com/r/SideProject/submit

## Title:
I built a PDF API because I kept hitting Sejda's free tier limit

## Body:
Hey r/SideProject,

I was building an invoicing tool and needed to generate PDFs programmatically. Every time I asked Claude/ChatGPT for HTML with print CSS, I'd paste it into Sejda to convert — but I'd hit the 3-free-conversions limit and have to wait hours.

So I built PDFPing (https://pdfapi.uhadev.com).

It's one API call:

```
curl -X POST https://pdfapi.uhadev.com/api/v1/convert \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"html": "<h1>Invoice</h1><p>...</p>"}' \
  -o invoice.pdf
```

- Real Chromium rendering (CSS, fonts, images all work)
- Free tier: 10 conversions/mo (no credit card)
- Pro: $9/mo (500)
- Business: $29/mo (5000)

Built with Express + Playwright, deployed on Railway, payments via Lemon Squeezy.

Would love any feedback on pricing, docs, or the landing page!
