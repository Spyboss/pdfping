# Post this to r/webdev at https://new.reddit.com/r/webdev/submit

## Title:
Showoff Saturday: Open-sourced a PDF generation API — HTML to PDF in one POST

## Body:
Just shipped PDFPing — a zero-config HTML to PDF API that's now open source (MIT).

The problem: LLMs generate great HTML with print CSS, but converting that to a real PDF always meant hitting free-tier walls or pulling out a credit card.

So I built this:

```javascript
fetch('https://pdfapi.uhadev.com/api/v1/convert/public', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html: '<h1>Report</h1><p>Generated via API</p>' })
})
.then(res => res.blob())
.then(blob => saveAs(blob, 'report.pdf'));
```

- No API key needed for the public endpoint (50 conversions/day per IP)
- Full Chromium rendering — CSS Grid, Flexbox, web fonts, JavaScript
- Free tier for developers who sign up
- Open source if you want to self-host

Built with Express + Playwright + Chromium. Deployed on Railway.

https://github.com/Spyboss/pdfping
https://pdfapi.uhadev.com
