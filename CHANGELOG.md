# Changelog

## 1.0.0 (2026-07-25)

### Breaking Changes

- **API key hashing**: API keys are now stored as SHA-256 hashes in the database.
  The `key` column is no longer `NOT NULL`. Keys are shown once at creation and
  cannot be retrieved later. If you have existing keys, the migration script
  automatically hashes them on startup.
- **Usage counter is now atomic**: Previously, the counter used a read-then-write
  pattern that could race under concurrent requests. The new `increment()` RPC
  uses `UPDATE ... SET used_count = used_count + 1`. If you relied on the old
  behavior, the counter values may differ slightly (correctly).
- **`--single-process` removed**: The previous Dockerfile used `--single-process`
  which caused browser crashes under concurrent load. The service now uses a
  multi-process Chromium with proper mutex-based pool management.

### Features

- Token bucket rate limiting with `express-rate-limit` (50 req/day public, 10 req/hr key generation)
- SHA-256 API key hashing — plaintext keys never stored in database
- Mutex-based browser pool — concurrent requests are serialized safely
- Input validation with size caps (1MB HTML, 2048 char URL) and URL format validation
- Centralized error handler — no stack traces leaked to clients
- `demo-invoice.html` static route
- OpenAPI 3.0 specification (`api/openapi.yaml`)
- Operational metrics endpoint (`/api/v1/metrics`) — render times, active contexts, failure tracking
- Architecture documentation (`ARCHITECTURE.md`)
- Benchmark results (`BENCHMARKS.md`)

### Bug Fixes

- **Browser crash under load**: Running 4/10 requests succeeded previously; now 15/15 pass under concurrency. Root cause: `--single-process` flag causing cascade failures when multiple browser contexts contended for a single process. Fixed by removing the flag and adding `--disable-software-rasterizer`.
- **API keys stored in plaintext**: `key` column now nullable; `key_hash` column stores SHA-256 digest.
- **Key generation unthrottled**: Anyone could generate unlimited keys with only an email. Fixed with rate limiter (10/hr) + email validation.
- **Usage counter race condition**: Two concurrent requests could increment the counter from the same base value, losing one increment. Fixed with atomic SQL update.
- **Stack trace leak**: Malformed JSON returned Express HTML error page with file paths. Fixed with centralized `entity.parse.failed` handler.
- **Invalid URL returns 500**: URLs were passed directly to Chromium without validation. Fixed with URL constructor check.
- **`demo-invoice.html` 404**: Docker `WORKDIR` change broke the relative static path. Fixed with explicit route.
- **Rate limiter resets on restart**: In-memory `Map` replaced with `express-rate-limit` with proper window tracking.

### Migration Notes

If upgrading from a pre-1.0.0 deployment:

```sql
-- 1. Add key_hash column, drop NOT NULL on key
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_hash text;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix text;
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
UPDATE api_keys SET key_hash = encode(sha256(key::bytea), 'hex') WHERE key_hash IS NULL AND key IS NOT NULL;
ALTER TABLE api_keys ALTER COLUMN key_hash SET NOT NULL;
ALTER TABLE api_keys ALTER COLUMN key DROP NOT NULL;

-- 2. Replace increment function with atomic version
DROP FUNCTION IF EXISTS increment(uuid);
CREATE OR REPLACE FUNCTION increment(api_key_id uuid)
RETURNS int LANGUAGE plpgsql AS $$
BEGIN
  UPDATE api_keys SET used_count = used_count + 1 WHERE id = api_key_id;
  RETURN (SELECT used_count FROM api_keys WHERE id = api_key_id);
END;
$$;
```

The server also runs an automatic migration on startup that hashes any remaining
un-hashed keys.

### Benchmarks

| Concurrency | Requests | Success Rate | Avg Latency | P95 | P99 |
|---|---|---|---|---|---|
| 10 | 100 | 100% | 2,332 ms | 2,737 ms | 2,752 ms |
| 20 | 200 | 100% | 2,519 ms | 3,485 ms | 3,548 ms |
| 50 | 500 | 90.2% | 4,923 ms | 5,772 ms | 5,813 ms |

Zero browser crashes across 800 requests. See [BENCHMARKS.md](BENCHMARKS.md) for full details.
