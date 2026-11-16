# Stack research — 15 November 2026

Scope: Stellarcope's actual code and the reliability problems reproduced in the local experiment. This is a dated review of primary documentation, releases, and specifications. A release announcement establishes availability and documented behavior; it does not establish a performance improvement for our workload. Recommendations below are engineering judgments.

The later [selected baseline](2026-11-15-decisions.md) resolves the options below using package compatibility and architecture experiments. In particular, TypeScript 6.0.3 is selected because the current typed-lint package does not support TS 7, despite that compiler's release.

## What the repository actually uses

At commit `65039247c42f17f140009444db11645804f33c93`, the package manifest declares React 18, Vite 5, TypeScript 5.7, node-postgres 8, and Stellar SDK 13. The backend uses `node:http`; web events and API samples have custom storage/query code. Umami and an OTLP receiver are not integrated into the application. The experiment runs them separately.

The important runtime problems are early acknowledgements, replay duplicates, tenant attribution, cumulative metric state, histogram compatibility, and operational failure boundaries. Updating syntax or switching languages cannot independently fix them.

## Recent changes that matter

| Area | Verified current development | Consequence for Stellarcope |
|---|---|---|
| Node.js | Node 26 is LTS; 24 and 22 remain supported LTS lines. Node 27 is Alpha. [Release policy](https://nodejs.org/en/about/previous-releases) | Prefer a tested LTS image. Node 24 is a conservative near-term target; evaluate 26 separately. Keep Umami's runtime under upstream's image ownership. |
| Native TypeScript | Node can strip supported TS syntax, but does not type-check and ignores `tsconfig.json`. [Runtime documentation](https://nodejs.org/api/typescript.html) | Existing direct `.ts` execution can remain simple. CI still needs `tsc`, including `api/tsconfig.json`; use explicit `import type` and compatible syntax. |
| TypeScript | TS 7.0's native compiler is released; published gains concern tooling/builds. [Release announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/) | Evaluate a compiler upgrade in isolation with the existing build and plugins. It does not make event ingestion faster at runtime. |
| OTel JS | SDK 3.0 released in November, supports proper ESM/CJS exports, and requires Node >=22.15. SDK 2.x has a stated one-year support window. [Announcement](https://opentelemetry.io/blog/2026/otel-js-sdk-3-0/) | Use a pinned, compatible SDK for Stellarcope self-instrumentation. Tenant interoperability should depend on OTLP and metric semantics, not everyone upgrading to the same JS SDK. |
| Collector batching | The November 11 guidance deprecates the standalone batch processor in favor of queue-integrated batching. New defaults/removal are planned for 2027. [Migration guidance](https://opentelemetry.io/blog/2026/collector-batching-migration/) | Configure explicitly now. The pinned 0.165.0 helper enables batching by the presence of `batch`; its documented configuration differs from the newer blog's `enabled` examples. Test the actual image/config combination. |
| PostgreSQL | Current maintenance releases are 18.7 and 17.12; 19 RC is not a production target. [Version policy](https://www.postgresql.org/support/versioning/) | Keep managed PostgreSQL on a maintained minor. The extended lab was moved from cached 17.11 to 17.12. No analytics requirement currently justifies a major upgrade by itself. |
| Umami | 3.5.0 is the current release checked, including additional tracking capabilities. [Release](https://github.com/umami-software/umami/releases/tag/v3.5.0) | Pin and review the image/config. Explicitly leave replay, error tracking, identity enrichment, and other unnecessary collection disabled. An upgrade must not silently broaden collection. |
| Frontend | React 19.3 is announced; Vite 8 uses Rolldown/Oxc tooling. [React releases](https://react.dev/blog), [Vite migration](https://vite.dev/guide/migration) | Preserve the SPA. Upgrade supported tooling in a separate change, verify plugins/browser targets and tracker output. Rust-based build tools can help without rewriting our backend in Rust. |
| Stellar | Latest stable SDK release found is 17.4.0, versus the repository's declared 13.x. [Release](https://github.com/stellar/js-stellar-sdk/releases/tag/v17.4.0) | Schedule a separate SDK compatibility upgrade with testnet signing/seal verification; the RFP requests a current stable Stellar stack. Do not mix it with ingestion changes. |
| API contracts | OpenAPI 3.2.1 is published. [Specification](https://spec.openapis.org/oas/v3.2.1.html) | Publish explicit HTTP request/response/error contracts. Choose a schema dialect supported by the validator and OpenAPI generator together; the newest document version is not a reason to break tooling. |

## JavaScript/TypeScript practices worth adopting

Keep small modules organized around responsibilities: enrollment, web admission, Umami adapter, metric ingestion, reporting, and jobs. Keep business logic independent of deployment wrappers. Avoid a generic repository framework, dependency-injection container, or event bus unless a concrete dependency makes one useful.

Use runtime schemas at every external boundary. TypeScript types disappear at runtime. A small Fastify HTTP layer is a reasonable recommendation as authenticated endpoints grow: its documented JSON Schema validation and response serialization replace manual boundary code. Schemas must be trusted application code, and database authorization belongs after structural validation. Explicitly handle the tracker's beacon content type; default JSON-only parsing is insufficient for every beacon shape. [Fastify guidance](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)

Bound request bytes, decompressed bytes, point counts, concurrent work, connection waits, and retries. Pass cancellation/deadlines to outbound calls. Shut down by stopping new work and awaiting admitted work within a deadline. Background promises and graceful shutdown do not replace persistence against SIGKILL.

Use explicit authenticated tenant context in domain methods. Request-local logging context can improve diagnostics, but do not depend on process-local context to authorize delayed jobs. Persist only the verified tenant identifier and a versioned, sanitized envelope. Do not put bearer tokens in attributes or logs.

Retain SQL and node-postgres where they already work. The existing transaction helper correctly obtains one client; preserve that property. Receipts, checkpoint changes, and aggregate effects must share a transaction on that client. [node-postgres transaction contract](https://node-postgres.com/features/transactions)

## Correctness practices that remain essential

**Safe retries require durable identity.** Give each intentional web event a fresh ID and retain it across retries. Store the tenant-scoped ID, payload fingerprint, and database effects atomically. Reusing an ID for changed content is a conflict. Receipt retention must outlive the longest allowed late retry. This is established practice, not a new queue feature. [AWS idempotent API guidance](https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/)

**OTel queues have specific limits.** Persistence can survive a process restart with retained storage. Auth-extension context is excluded, enqueue failures do not enter exporter retries, and permanent errors or elapsed retry limits can discard previously accepted data. Queue capacity is finite even with infinite retry time. Bind tenant identity before the queue and monitor admission, queue age, enqueue errors, export failures, and disk capacity. [Pinned exporter-helper contract](https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector/v0.165.0/exporter/exporterhelper/README.md)

**Cumulative metrics need durable baselines.** The standard cumulative-to-delta processor holds state and needs consistent stream routing. A persistent exporter queue does not persist this baseline. Prefer native delta export where tenants can configure it; support cumulative input by persisting source points and checkpointing conversion transactionally, preserving resource, scope, instance, and restart identity. Unknown first intervals and out-of-order points need explicit policies. [Processor behavior](https://raw.githubusercontent.com/open-telemetry/opentelemetry-collector-contrib/v0.165.0/processor/cumulativetodeltaprocessor/README.md), [metrics data model](https://opentelemetry.io/docs/specs/otel/metrics/data-model/)

**HTTP metric definitions matter.** Prefer stable `http.server.request.duration` in seconds, template routes, and bounded status attributes. Its histogram already contains request counts: do not add an overlapping request counter. Keep histogram boundaries/version with stored data; merge only compatible buckets or conservatively coarsen to shared boundaries. Do not invent precision in the final unbounded bucket. During semantic-convention migration, avoid counting old and new metrics together. [HTTP conventions](https://opentelemetry.io/docs/specs/semconv/http/http-metrics/)

**Cardinality controls change what a chart can claim.** SDK overflow can preserve total measurements while removing their original route/status attributes. Keep an overflow indicator and an unattributed bucket; use SDK Views plus backend tenant budgets. Dropping attributes downstream cannot recover detail already combined upstream. [Current cardinality guidance](https://opentelemetry.io/blog/2026/cardinality-limits-in-opentelemetry/)

**Tenant isolation is enforced at several boundaries.** Verify credentials before attribution; scope dashboard permissions and Umami website access; use PostgreSQL RLS on Stellarcope tenant tables with a non-owner, non-BYPASSRLS runtime role. Set tenant context within the same transaction/connection, not on a pooled session indefinitely. RLS prevents omitted-filter errors; an application allowed to set arbitrary tenant context still needs trustworthy authorization. [PostgreSQL rules](https://www.postgresql.org/docs/current/ddl-rowsecurity.html), [AWS pooled tenancy guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html)

**Browser scheduling is not a server receipt.** `sendBeacon()` returning true means the browser queued data; it does not expose the server's commit result. Normal page activity can use acknowledged requests with bounded retries; page-exit collection remains best effort unless a separate privacy-reviewed durable browser mechanism is adopted. [W3C Beacon draft](https://www.w3.org/TR/beacon/)

**Protocol success needs its own contract.** OTLP has specific retryable statuses and non-retryable partial-success semantics. A test receiver for JSON histograms is not complete OTLP support. Preserve the Collector for public protocol handling, and explicitly specify the internal adapter's supported data types/encoding. [OTLP specification](https://opentelemetry.io/docs/specs/otlp/)

## Alternative stacks and newer designs

| Candidate | Concrete advantage | Cost or mismatch | Recommendation |
|---|---|---|---|
| TypeScript app + standard Collector | Reuses our code and upstream protocol/retry/auth components | We still own a bounded metrics-to-SQL adapter | Preferred starting point. |
| Go adapter/custom Collector exporter | Direct Collector `pdata` access and native exporter-helper integration | Another language or custom distribution; component upgrades and lifecycle tests become our responsibility | Reconsider if the TS adapter starts recreating broad OTLP semantics. Go 1.27.4 is current in the checked release history. [Go releases](https://go.dev/doc/devel/release), [Collector Builder](https://opentelemetry.io/docs/collector/extend/ocb/) |
| Rust/Axum/Tokio ingestion | Strong ownership model; mature HTTP middleware; explicit cancellation/shutdown tools | New implementation, dependencies, and operator knowledge; database/queue guarantees still required | No rewrite without measured CPU/memory or concurrency pressure. Rust 1.100.0 and Axum 0.8.9 were checked. [Rust](https://blog.rust-lang.org/2026/11/12/Rust-1.100.0/), [Axum](https://docs.rs/axum/0.8.9/axum/), [Tokio shutdown](https://tokio.rs/tokio/topics/shutdown) |
| OTel-Arrow/Rust pipeline | Relevant upstream work on efficient telemetry pipelines, beyond transport alone | A different component/operational surface; no local evidence of our required auth/persistence behavior or a bottleneck needing it | Watch, do not replace the tested Collector because of throughput claims. [Upstream project](https://github.com/open-telemetry/otel-arrow), [Phase 2 direction](https://opentelemetry.io/blog/2026/otel-arrow-phase-2/) |
| PostgreSQL job queue / PGMQ | Transactional jobs without a separate broker; useful for seals/erasure/reporting | Shares the database failure domain | Good background-job option; does not preserve admission during an outage of that same database. [PGMQ](https://github.com/pgmq/pgmq) |
| Independent managed web queue | Browser admission can continue while Umami/its database is unavailable | Extra service, duplicate deliveries, retention and erasure work | Recommended production option if we commit to available web admission during downstream outages. Not a substitute for idempotent Umami writes. |

## Hosting and availability

Use managed regional containers with documented persistent storage for the Collector, and managed PostgreSQL with backups/failover. Choose the provider after checking deployment, storage-reattachment, residency, and operational costs. Vercel can still host static assets; its current post-response database-write path should not define durable ingestion.

A provider SLA is not a measured application SLO. For example, SQS's published commitment is 99.9%; choosing it alone does not demonstrate 99.99% ingestion. Conversely, a service-credit threshold is not a forecast of actual uptime. Validate the whole admission path and its error budget. [Messaging SLA](https://aws.amazon.com/messaging/sla/), [SLO design](https://sre.google/workbook/implementing-slos/)

There is a relevant correction to older hosting assumptions: Cloudflare Queues now documents jurisdiction restrictions, including EU. Its producer/consumer Workers can still run elsewhere. Queue jurisdiction alone is not evidence of EU-only processing across the complete pipeline. [Current data-location rules](https://developers.cloudflare.com/queues/configuration/data-location/)

Track collection health and data freshness independently from adoption. An empty chart may mean no activity, no collector, expired credentials, or a backlog. Use known synthetic traffic and distinguish complete, delayed, and incomplete periods. [Missing telemetry guidance](https://opentelemetry.io/blog/2026/when-missing-telemetry-is-the-signal/)

## Adoption order

1. Define admission, tenant identity, retry identity, metric semantics, and retention contracts.
2. Replace early acknowledgement and duplicate-prone persistence paths; integrate internal Umami with one source of web truth.
3. Integrate the tested Collector configuration and a production metrics adapter with real SDK/Protobuf compatibility tests.
4. Select hosting and, if needed for the chosen web-admission commitment, a managed web queue. Prove failover and recovery in staging.
5. Upgrade runtime/tooling/Stellar dependencies in separate, reversible changes. Measure before adopting alternate runtimes.

This order addresses the observed failures while keeping upgrade regressions separate from architecture changes.

## Follow-up: TypeScript and package-level coverage

The original review included post-2024 releases, but it was an architecture-focused review, not a complete audit or benchmark of every dependency. TypeScript, Fastify, and frontend upgrades were researched; the real OTel JS SDK was integration-tested. Those evidence levels must not be conflated.

Additional current documentation checked in response to the follow-up:

| Practice / candidate | Current primary evidence | Application to this project |
|---|---|---|
| Erasable TypeScript | [TS 5.8 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-8.html), [Node guidance](https://nodejs.org/api/typescript.html) | For direct backend `.ts` execution, evaluate `erasableSyntaxOnly`, retain `verbatimModuleSyntax`, use explicit type imports, and keep Node-compatible module resolution. Frontend bundler configuration remains separate. |
| Typed linting | [typescript-eslint setup](https://typescript-eslint.io/getting-started/typed-linting/) | Evaluate `recommendedTypeChecked` with `projectService`, especially promise-handling rules. Check compiler/parser version compatibility before enabling it; TS 7 compiler compatibility is not established by the compiler release announcement. This is current guidance, not a claim that typed linting first appeared after 2024. |
| One schema for runtime and static types | [Fastify type providers](https://fastify.dev/docs/latest/Reference/Type-Providers/), [TypeBox provider compatibility](https://github.com/fastify/fastify-type-provider-typebox) | Infer request/response types from schemas instead of maintaining parallel interfaces and validators. TypeBox/JSON Schema fits the proposed Fastify boundary; verify the complete provider/Ajv/Swagger combination before pinning versions. |
| Zod 4 alternative | [Zod 4 changes](https://zod.dev/v4), [Zod 4.6 announcement, September 9, 2026](https://zod.dev/blog/zod-4-6), [current Fastify Zod provider](https://github.com/fastify/fastify-type-provider-zod) | A viable alternative with current improvements; the provider documents Zod >=4.2 and distinct input/output serialization semantics. Do not apply older Zod 3 integration examples or install both schema systems without a need. No local TypeBox-versus-Zod performance comparison has been run. |
| Fastify 5 boundary changes | [Migration guide](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) | Full JSON Schemas are required under its default validator, custom logger instances have a different option, and plugins must use a consistent callback/promise style. Fastify 5 itself originated in 2024; current documentation is not evidence that every feature is newer. |

This supports a concrete direction: modern ESM TypeScript, runtime-validated boundaries with inferred types, explicit promise/cancellation handling, and a compatible pinned package set. It does **not** establish a final dependency lockfile or prove that every optional package is better for Stellarcope. No application dependencies were upgraded during this investigation.
