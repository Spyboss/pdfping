#!/usr/bin/env python3
"""Post PDFPing to Reddit communities."""

import praw
import sys
import os

CLIENT_ID = os.environ.get("REDDIT_CLIENT_ID", "")
CLIENT_SECRET = os.environ.get("REDDIT_CLIENT_SECRET", "")
USERNAME = os.environ.get("REDDIT_USERNAME", "")

POSTS = {
    "SideProject": {
        "title": "I built a PDF API because I got tired of hitting Sejda's free tier limit",
        "body": """Hey r/SideProject,

I was building a tool that generates invoices and reports. Every time I needed a PDF, I'd ask Claude/ChatGPT for HTML with print settings, then paste it into Sejda to convert. But I'd hit the free tier limit after ~3 conversions and have to wait hours.

So I built PDFPing (https://pdfapi.uhadev.com).

It's a dead-simple API:
```
curl -X POST https://pdfapi.uhadev.com/api/v1/convert \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -d '{"html": "<h1>Invoice</h1><p>...content...</p>"}' \\
  -o invoice.pdf
```

What it does:
- POST HTML or a URL → get a PDF back
- Real Chromium rendering (all CSS, fonts, images work)
- Free tier: 10 conversions/month (no credit card)
- Pro: $9/mo (500 conversions)

Built with Express + Playwright + Lemon Squeezy, deployed on Railway.

Would love any feedback — especially on pricing and docs. What would make this useful for your workflow?
""",
    },
    "webdev": {
        "title": "Showoff Saturday: Made an API that converts HTML to PDF in one POST request",
        "body": """Just shipped PDFPing — a zero-config PDF generation API.

Why I built it: LLMs are great at generating HTML with print CSS, but converting that HTML to an actual PDF always required extra tools with rate limits (Sejda, etc.). So I made my own.

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

Free tier available at https://pdfapi.uhadev.com — no credit card needed.

Tech stack: Express, Playwright (Chromium), Stripe, Railway, Cloudflare.

Would love feedback on the landing page and API design!
""",
    },
    "SaaS": {
        "title": "Launched a micro-SaaS: HTML-to-PDF API. Month 1 update coming soon.",
        "body": """Launched PDFPing (https://pdfapi.uhadev.com) — a straightforward PDF generation API.

The problem: I needed programmatic PDF generation for invoices. Existing solutions like pdfcrowd ($20/mo) and PDF.co ($25/mo) felt expensive for my use case. Self-hosting Playwright was annoying.

PDFPing solves it with a single POST endpoint. Free tier gets you 10 conversions to try it out, then $9/mo for 500.

Would appreciate any feedback on the landing page or the product in general.
""",
    }
}

def main():
    client_id = CLIENT_ID or input("Reddit Client ID: ").strip()
    client_secret = CLIENT_SECRET or input("Reddit Client Secret: ").strip()
    username = USERNAME or input("Reddit Username: ").strip()
    password = input("Reddit Password: ").strip()

    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        password=password,
        user_agent=f"linux:pdfping-promo:v1.0 (by /u/{username})",
        username=username,
    )

    print(f"\nLogged in as: {reddit.user.me()}\n")

    subs = list(POSTS.keys())
    print("Available subreddits:")
    for i, sub in enumerate(subs, 1):
        print(f"  {i}. r/{sub}")

    choices = input("\nEnter numbers to post to (comma-separated, e.g. '1,2'): ").strip()
    indices = [int(c.strip()) for c in choices.split(",") if c.strip().isdigit()]

    for idx in indices:
        if 1 <= idx <= len(subs):
            sub_name = subs[idx - 1]
            post = POSTS[sub_name]
            try:
                submission = reddit.subreddit(sub_name).submit(
                    title=post["title"],
                    selftext=post["body"],
                )
                print(f"✅ Posted to r/{sub_name}: {submission.url}")
            except Exception as e:
                print(f"❌ Failed r/{sub_name}: {e}")
        else:
            print(f"❌ Invalid choice: {idx}")


if __name__ == "__main__":
    main()
