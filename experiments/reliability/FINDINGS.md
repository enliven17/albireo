# Reliability findings — 15 November 2026

The expanded local decision suite has **24 scenarios**. "Passed" means behavior matched the assertions, including negative controls that intentionally demonstrate loss or incorrect application results. This is evidence for architecture choices, not a certification of the application.

Run instructions and fixture boundaries are in the [README](README.md). A stable machine-readable [evidence snapshot](evidence/2026-11-15.json) is retained alongside this report. Full logs, generated configs, and resolved fixture dependencies are in the ignored `results/` directory on the machine that ran the suite.

## Measured outcomes

| Scenario | Result | Architectural implication |
|---|---|---|
| Real Umami baseline | 1 event → 1 row | Real upstream write path is exercised. |
| Same Umami request twice | 2 requests → 2 event IDs | Upstream request body equality is not idempotency. |
| Umami commits, response is lost, caller retries | 1 intended event → 2 rows | A queue/proxy retry can inflate web analytics. |
| Real OTel baseline | 1 point → 1 row | Receiver/exporter/database path is exercised. |
| Database outage + persistent Collector SIGKILL | 10 accepted before crash + 5 after restart → all 15 stored; direct Umami returned 500 and stored 0 | Persistent queue separates metric admission from the database; a stopped receiver is still unreachable. |
| Explicit Umami retry after recovery | Previously failed event → 1 row | Retryable failure permits recovery only if the caller actually retries. |
| Memory-only Collector crash | 10 accepted → 0 replayed; post-restart marker delivered | HTTP success from memory buffering does not survive process death. |
| Metric commit, response lost, exporter retries | 2 raw writes → 1 deduplicated point | Queue delivery is at least once; database effects need idempotency. |
| Authenticated two-tenant replay | Correct A/B attribution after crash; forged tenant replaced; missing/wrong-audience credentials returned 401 | Resolve identity before queueing, not from caller attributes or transient auth context afterward. |
| Attribute allowlist | Synthetic email and raw URL absent after queue replay | Narrow pre-persistence filtering works; this is not a complete privacy test. |
| Actual OTel JS SDK 3.0 | 3 delta histogram observations stored under tenant A | More than synthetic OTLP JSON is exercised; this is one SDK/transport profile. |
| Metrics-only receiver | Trace/log paths returned 404 | No trace/log persistence pipeline is configured. |
| Canonical point identity | Reordered attribute maps: 2 raw writes, 1 dedup point; changed contents returned 400 | Attribute order must not change identity; conflicts need explicit rejection. |
| Actual application long-latency histogram | Single 100000ms observation reports p95 19500ms | Current quantile implementation invents an upper bound for the overflow bucket. **Known application defect remains unfixed.** |
| Queue-integrated batching + SIGKILL | All 3 previously accepted points recovered | Batched data can remain under the persistent queue's ownership. |
| Batch processor before persistent queue + SIGKILL | All 3 previously accepted points lost | In-memory preprocessing can undermine downstream persistence. |
| Queue capacity 2, downstream unavailable | Some requests accepted; remaining requests returned 503; all accepted points drained | Queue capacity is an admission limit, not a guarantee of limitless outage coverage. Exact scheduling-dependent counts are in the snapshot. |
| Permanent downstream HTTP 400 | Accepted point dropped; no row stored | Durable buffering does not override permanent error classification. |
| Three-second retry limit, downstream 503 | Accepted point dropped after retries | Retry expiration is a data-loss policy; monitor and design recovery explicitly. |
| Persistent queue volume removed | Accepted pending point lost; fresh-volume marker delivered | Process persistence is not replicated storage or HA durability. |
| Native cumulative-to-delta restart, `initial_value: keep` | Source 100 → 150 → restart → 200 produced total **350**, not 200 | Persistent export storage does not persist processor baselines. This specifically tests `keep`, not every initial-value policy. |
| Atomic web pattern fixture | Lost response + 8 concurrent retries → 1 effect per tenant; changed payload 409; injected failure left neither receipt nor effect | Atomic receipts/effects solve the pattern; this fixture does not patch Umami. |
| Durable integer counter fixture | Restart + 8 concurrent retries retained total 200; separate epoch 10 and instance 40; conflicts 409 and invalid order/reset 422 | Checkpoints and effects can be durable/atomic in PostgreSQL; full histogram conversion is not implemented. |
| PostgreSQL RLS | A/B reads isolated; cross-tenant write SQLSTATE 42501; reused connection without tenant context saw 0 rows | Non-owner role plus transaction-scoped context is a viable defense against omitted tenant filters. |

## What changed in the recommendation

Keep the standard Collector and its native persistent exporter queue. Configure queue-integrated batching explicitly and preserve verified tenant identity in the sanitized payload. There is no demonstrated need for a second metrics queue merely to survive the tested database/process outages.

Web collection has a different boundary: unmodified Umami is both database-dependent and non-idempotent. A managed independent queue is a reasonable production addition when web admission must continue through downstream outages. It requires an idempotent Umami write extension and identity preparation that survives delayed replay. Adding the queue alone makes duplicate delivery more likely, not more correct.

Cumulative metric conversion belongs in durable, transactionally checkpointed processing if broad SDK compatibility is required. Native delta export is simpler where available. The standard in-memory processor plus a persistent exporter queue cannot be assumed to provide durable cumulative accounting.

These choices preserve TypeScript and PostgreSQL. The experiment found no evidence that a Rust/Go rewrite is needed to correct the observed behavior. Runtime performance was not benchmarked.

## Evidence boundaries

Real services: Umami 3.5.0, Collector Contrib 0.165.0, PostgreSQL 17.12, Node 24.19.0 fixture image, OTel JS metrics SDK/resources 3.0.0 and HTTP exporter 0.300.0. The harness ran on Node 22.22.3. Exact image identities, PostgreSQL version output, code hashes and timestamps are in the snapshot. Earlier successful runs used cached PostgreSQL 17.11 before the fixture was updated.

The experiment deliberately separates three kinds of evidence:

- **Upstream behavior:** actual Umami writes, native Collector persistence/batching/retry/auth/conversion, an actual JS SDK export, and actual PostgreSQL RLS.
- **Pattern prototypes:** fixture-only atomic web receipts and integer counter checkpoints. These show a solution shape, not completed application integrations.
- **Code defect reproduction:** the real Stellarcope histogram helper is imported directly. The assertion records its existing wrong result so the defect is visible.

Database outages include a 15-second hold; this is a bounded functional test at tiny volume. Observed milliseconds are not latency benchmarks, monthly availability, or cloud recovery guarantees. Disk-volume removal is a storage-loss model, not physical corruption/failover. The fixture doesn't exercise multi-zone recovery, sustained load, disk-full errors, every credential edge, every OTLP encoding, or cumulative histogram-vector conversion.

The previously missing local cases—authenticated replay, batch ordering, queue exhaustion/loss, permanent/expired retries, cumulative restart state, concurrent atomic patterns, and actual RLS—are covered. The [architecture acceptance gates](../../engineering/architecture-proposal.md#production-acceptance-gates) identify the separate production work still required. Do not describe that work as already tested or deployed.
