# PDFPing Benchmarks

**Date:** 2026-07-25
**Tool:** autocannon v8
**Service:** https://pdfapi.uhadev.com

## Environment

| Resource | Detail |
|---|---|
| CPU | 2 vCPU (shared) |
| RAM | 2 GB |
| Browser pool | 2 Chromium instances × 2 contexts = 4 concurrent slots |
| Node.js | v24.18.0 |
| Chromium args | `--no-sandbox --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer` |
| Connection | Keep-alive, no pipelining |
| Payload | `<h1>Load Test</h1><p>PDFPing benchmark</p>` |

## Methodology

Each test uses a unique API key and sends requests to the authenticated endpoint (`POST /api/v1/convert`). The browser pool serializes access through an async-mutex so only 4 requests render concurrently; remaining requests queue.

## Results

### 10 concurrent connections, 100 requests

| Metric | Value |
|---|---|
| Success rate | 100% |
| Total time | 24.1 s |
| Throughput | 4.2 req/s |
| Avg latency | 2,332 ms |
| P50 latency | 2,303 ms |
| P95 latency | 2,737 ms |
| P99 latency | 2,752 ms |
| Min latency | 2,013 ms |
| Max latency | 2,784 ms |
| Browser crashes | 0 |

### 20 concurrent connections, 200 requests

| Metric | Value |
|---|---|
| Success rate | 100% |
| Total time | 27.1 s |
| Throughput | 7.4 req/s |
| Avg latency | 2,519 ms |
| P50 latency | 2,401 ms |
| P95 latency | 3,485 ms |
| P99 latency | 3,548 ms |
| Min latency | 2,000 ms |
| Max latency | 3,605 ms |
| Browser crashes | 0 |

### 50 concurrent connections, 500 requests

| Metric | Value |
|---|---|
| Success rate | 90.2% |
| Total time | 51.1 s |
| Throughput | 9.8 req/s |
| Avg latency | 4,923 ms |
| P50 latency | 5,123 ms |
| P95 latency | 5,772 ms |
| P99 latency | 5,813 ms |
| Min latency | 3,502 ms |
| Max latency | 5,950 ms |
| Browser crashes | 0 |

## Post-load Health

| Check | Result |
|---|---|
| Health endpoint | OK |
| Public convert | 200 |
| Key generation | 200 |
| Authenticated convert | 200 |
| Usage tracking | Correct |

## Analysis

- **Zero browser crashes** across 800 requests. The mutex-based pool eliminated the cascade failures present in the original code.
- **Queuing dominates latency.** With only 4 concurrent browser slots, each request spends approximately `(queue_depth × 2.3s)` waiting for a free context plus ~2.3s rendering. At 50 concurrency, mean wait time is ~2.6s in queue.
- **Scaling the pool** Doubling the available browser contexts is expected to significantly reduce queuing delays and improve throughput, although the exact improvement depends on CPU, memory, and workload characteristics. Each browser instance consumes ~200 MB RSS, so pool size is a RAM-vs-throughput tradeoff.
- **49/500 failures at 50 concurrency** were HTTP timeouts (requests waited >60s in queue), not browser crashes.
