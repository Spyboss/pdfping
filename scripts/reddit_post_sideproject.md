# Post this to r/SideProject at https://new.reddit.com/r/SideProject/submit

## Title:

I open-sourced my HTML to PDF API — free tier, MIT license, Chromium rendering

## Body:

Hey r/SideProject,

I kept finding myself needing to convert HTML to PDF for side projects — invoices, reports, certificates. Every service had low free limits or required a credit card upfront.

So I built PDFPing (https://pdfapi.uhadev.com) and open-sourced it.

One API call:
```
curl -X POST https://pdfapi.uhadev.com/api/v1/convert/public \
  -H "Content-Type: application/json" \
  -d '{"html": "<h1>Invoice</h1><p>...</p>"}' \
  -o output.pdf
```

Free tier is 50 conversions/day without even signing up. Sign up for a dedicated key with a dashboard.

Tech stack: Express, Playwright + Chromium, Supabase, Lemon Squeezy. Self-hostable if you need to (MIT license). Deployed on Railway.

https://github.com/Spyboss/pdfping

Would love feedback on the docs, the pricing, or anything else that feels off.
