# Post this to r/webdev at https://new.reddit.com/r/webdev/submit

## Title:
Showoff Saturday: I made a free API that converts HTML to PDF in one POST request

## Body:
Just shipped PDFPing — a zero-config PDF generation API.

Why: LLMs are great at generating HTML with print CSS, but converting that to an actual PDF always required extra tools with rate limits. So I built my own. And made it free.

```javascript
fetch('https://pdfapi.uhadev.com/api/v1/convert', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    html: '<h1>Report</h1><p>Generated via API</p>'
  })
})
.then(res => res.blob())
.then(blob => saveAs(blob, 'report.pdf'));
```

No pricing, no credit card, no tiers. Chrome DevTools-faithful PDF rendering thanks to Playwright + Chromium. Sign up at https://pdfapi.uhadev.com for a free API key, or use the public endpoint directly.

Open source: https://github.com/Spyboss/pdfping
