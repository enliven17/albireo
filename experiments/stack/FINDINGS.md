# Decision-lab results — 15 November 2026

Final run: **22 orchestration checks passed**, including expected rejection of the unsupported compiler/linter combination. Within those checks, all **10 focused integration tests**, the existing application's **19 tests**, and **five browser routes** passed. Node 24 also passed its unit profile; its two external-service tests were intentionally skipped, then exercised on Node 26.

The [machine-readable evidence](evidence/2026-11-15.json) contains versions, image identities, source hashes, timings, results and cleanup status. The [integration log](evidence/integration-results.log) retains database/Umami assertions. Both [backend](evidence/backend-advisories.json) and [frontend](evidence/frontend-advisories.json) runtime dependency graphs reported zero known npm advisories at this check.

| Question | Observed result | Decision |
|---|---|---|
| TS 7 or TS 6? | Both type-check the fixture; current typed-linting peers reject 7 | TS 6.0.3, with supported linting. |
| TypeBox or Zod? | Both validate inputs and generate valid OpenAPI; TypeBox uses the selected framework's native schema path | TypeBox, with inferred request/response types. |
| Do stricter everyday rules catch real mistakes? | Missing response statuses failed compilation; negative controls catch unhandled and `void`-discarded promises, unsafe indexed reads and explicit undefined optionals | Adopt the tested rules for migrated modules. |
| Does the upgraded package set fit? | Node 26 build/API checking, 19 existing tests, and five Chrome routes pass after small type annotations | Upgrade without a frontend rewrite; retain exact locks. |
| Is a local Collector queue necessary? | Broker-backed synchronous admission survived a database outage and Collector restart without a local volume; broker outage returned 503 | Stateless ingress into the already-selected managed queue service. |
| Can tenant spoofing survive a missing claim? | A signed token with no tenant could not preserve a forged resource tenant; returned 400 before publication. Expired/wrong-audience tokens returned 401 | Remove untrusted attribution before setting verified fields; validate before queueing. |
| Does filtering precede durable storage? | Synthetic scope email, raw URL and exemplars were absent from inspected queue payloads | Preserve those gates; add complete value/profile validation during implementation. |
| Is newer SDK interoperability real? | Actual SDK 3.0 Protobuf histogram exported three observations with the stable 14 HTTP boundaries; gzip JSON also worked | Keep the standard Collector for public protocol handling. |
| Does the size cap cover gzip? | A valid five-megabyte decoded request was rejected as too large, with native HTTP 400 | Document the tested four-MiB decoded limit and actual error behavior. |
| What if a large request partially publishes? | 1000 logical points produced 1464 physical point copies after injected partial failure/retry, packed into four messages, each <=240 KiB | Split bounded envelopes; preserve point identities; deduplicate database effects. |
| Can Umami remain near upstream? | Transactional writes to the real 3.5 schema produced pageviews=1, visitors=1, visits=1, bounces=0 through its reporting API. Eight concurrent replays did not duplicate events/properties; rollback removed receipt and effects | Narrow pinned-schema adapter, no UI fork, mandatory upgrade contract tests. |
| Can cumulative histograms remain correct? | Restart/concurrent replay retained count 200 and complete bucket vectors; instances/epochs summed to 250; unknown first interval counted only the later delta 50 | Durable source state, explicit baseline policy and compatible layouts. |
| Can reordered source points be repaired? | Inserting 100, then 200, then late 150 reconstructs 100+50+50 and corresponding bucket deltas | Immutable points plus deterministic ordered repair; no silent late-point discard. |
| Are integer/percentile assumptions safe? | 9007199254740993 round-trips exactly; unbounded percentile returns a lower bound rather than a fictitious value | Decimal strings/BigInt and honest interval estimates. |

The bounded local transport burst delivered all 1000 requests at concurrency eight, with p95 about **5.9 ms** in the final run. It uses a local emulator and tiny data; it is not a production throughput forecast or SLO measurement. Database rollup and real WAN/SQS/RDS behavior are not included in that timing.

The upstream resolver test also records same-hour visit-ID reuse after an inactivity boundary. Preserve and document the pinned Umami behavior; do not advertise a different generic session definition.

The [technology decisions](../../engineering/decisions.md) separate these decisions from remaining production implementation and cloud acceptance obligations. No production dependencies, application code, cloud resources or data were changed.
