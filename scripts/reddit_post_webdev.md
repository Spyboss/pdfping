Showoff Saturday: I made a free HTML-to-PDF API. One POST, no queues.

https://pdfapi.uhadev.com

LLMs generate HTML with print CSS. Converting that to a PDF always meant extra tools with rate limits. So I built one without any.

```
const res = await fetch('https://pdfapi.uhadev.com/api/v1/convert', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_KEY',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    html: '<h1>Report</h1><p>Generated via API</p>'
  })
})
const blob = await res.blob()
```

Playwright + Chromium under the hood. Same rendering you get in Chrome DevTools. Send HTML or a URL, get a PDF back.

Free API key at the link above. Public endpoint also available (50/day per IP, no key needed).

https://github.com/Spyboss/pdfping
