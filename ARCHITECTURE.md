# PDFPing Architecture

```
                         ┌─────────────────────────┐
                         │       Client             │
                         │  (curl, fetch, browser)  │
                         └───────────┬─────────────┘
                                     │ POST /api/v1/convert
                                     │ Authorization: Bearer <key>
                                     v
                     ┌───────────────┴───────────────┐
                      │       Express API (server.ts)   │
                     │                               │
                     │   ┌───────────────────────┐   │
                     │   │    Rate Limiter         │   │
                     │   │  (express-rate-limit)  │   │
                     │   │  - Public: 50/day/IP   │   │
                     │   │  - Key gen: 10/hr/IP   │   │
                     │   └───────────┬───────────┘   │
                     │               │               │
                     │   ┌───────────┴───────────┐   │
                     │   │   Input Validation     │   │
                     │   │   - html/url required  │   │
                     │   │   - URL format check   │   │
                     │   │   - Size caps (1MB)    │   │
                     │   └───────────┬───────────┘   │
                     │               │               │
                     │   ┌───────────┴───────────┐   │
                     │   │   Auth (findApiKey)    │   │
                     │   │   - SHA-256 hash key   │   │
                     │   │   - Supabase lookup    │   │
                     │   │   - Fallback: env keys │   │
                     │   └───────────┬───────────┘   │
                     └───────────────┼───────────────┘
                                     │
                                     v
                  ┌──────────────────┴──────────────────┐
                  │        Browser Pool (async-mutex)    │
                  │                                     │
                  │   ┌─────────────┐  ┌─────────────┐  │
                  │   │  Browser #1 │  │  Browser #2 │  │
                  │   │  (Chromium) │  │  (Chromium) │  │
                  │   └──────┬──────┘  └──────┬──────┘  │
                  │    ┌─────┴─────┐    ┌─────┴─────┐   │
                  │    │ Ctx 1 │Ctx2│   │ Ctx 1 │Ctx2│  │
                  │    └───────┴────┘   └───────┴────┘  │
                  │  Max: 4 concurrent rendering slots   │
                  └──────────────────┬──────────────────┘
                                     │
                                     v
                  ┌──────────────────┴──────────────────┐
                  │          Playwright API              │
                  │  page.setContent() / page.goto()     │
                  │  page.pdf({ format, landscape, ... })│
                  └──────────────────┬──────────────────┘
                                     │
                                     v
                  ┌──────────────────┴──────────────────┐
                  │           PDF Response               │
                  │  Content-Type: application/pdf       │
                  │  Content-Disposition: inline         │
                  │  filename="output.pdf"               │
                  └─────────────────────────────────────┘

                  ┌──────────────────────────────────────┐
                  │         Supabase (optional)           │
                  │                                      │
                  │  ┌────────────┐  ┌───────────────┐   │
                  │  │  api_keys  │  │  usage_logs    │   │
                  │  │  key_hash  │  │  api_key_id    │   │
                  │  │  email     │  │  endpoint      │   │
                  │  │  plan      │  │  status        │   │
                  │  │  used_count│  │  created_at    │   │
                  │  │  limit     │  │               │   │
                  │  └────────────┘  └───────────────┘   │
                  │                                      │
                  │  increment(api_key_id) — atomic RPC   │
                  └──────────────────────────────────────┘
```

## Request Lifecycle

1. Client sends `POST /api/v1/convert` with `Authorization` header
2. Rate limiter checks window (public endpoint) or passes through
3. Input validation rejects malformed/oversized payloads
4. Auth middleware hashes the API key (SHA-256), looks up in Supabase
5. Browser pool acquires a mutex lock, gets/reuses a Chromium instance
6. A new browser context + page is created (isolated per request)
7. Playwright renders the HTML or navigates to the URL
8. Page is exported as PDF via `page.pdf()`
9. Context and page are closed; browser is returned to pool
10. Usage counter is incremented atomically via Supabase RPC
11. PDF is streamed to the client

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Mutex-based pool (not connection pool) | Prevents concurrent browser launch cascade; serializes access safely |
| Per-request browser context | Isolates rendering — cookies, storage, and state are not shared |
| SHA-256 key hashing | Plaintext keys never stored in DB; only hash is persisted |
| `async-mutex` for key generation | Prevents race conditions on key creation for the same email |
| Atomic `UPDATE used_count + 1` | Eliminates read-then-write race in usage counting |
| In-memory rate limiter | Simple, no external dependency; resets on restart (acceptable for MVP) |
