# PDFPing - Agent Guide

## Project Overview
- HTML to PDF converter (web + API)
- Express + Playwright + Chromium on Railway
- Landing page served via express.static('../landing') from api/server.js
- Domain: pdfapi.uhadev.com (Cloudflare proxied CNAME to Railway)
- Supabase: jtsstzfuvykhiayragqm (ap-south-1)
- Payment: Stripe (test mode), migrating to Lemon Squeezy

## Key Files
- api/server.js: Main Express server
- landing/index.html: Landing page + web converter
- landing/blog/: SEO blog articles
- supabase/schema.sql: Database schema
- Dockerfile: Railway deployment
- railway.json: Build/deploy config

## Routes (api/server.js)
- POST /api/v1/convert - Authenticated HTML/URL to PDF
- POST /api/v1/convert/public - Public converter (5/day per IP)
- POST /api/v1/keys - Generate free API key (requires email)
- GET /api/v1/usage - Check usage/plan
- POST /api/v1/checkout - Create checkout session
- POST /api/v1/webhook - Stripe webhook
- GET /health - Health check

## Pricing
- Free: 10 conversions/month
- Pro: $9/mo, 500 conversions/month
- Business: $29/mo, 5,000 conversions/month

## SEO
- Target keywords: "html to pdf converter", "html to pdf api", "free html to pdf"
- FAQPage schema already added to landing page
- SoftwareApp schema with offer pricing already added
- Blog articles in landing/blog/
- Sitemap: landing/sitemap.xml
- Robots: landing/robots.txt

## Agent Capability Notes
- Use subagents in parallel for independent tasks (research + code + content)
- Write AGENTS.md pattern - this file acts as project memory for agent conventions
- Use MCP servers for extended capabilities (DB access, browser automation)
- Run reflection loops for code quality - have subagent review edits
- Use cron/loop patterns for ongoing monitoring tasks
