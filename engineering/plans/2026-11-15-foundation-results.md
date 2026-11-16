# Foundation implementation results — 2026-11-15

Implements all three tasks in the [foundation plan](2026-11-15-foundation.md), steps 1–3 of the [rollout](2026-11-15-rollout.md). Branch: `codex/implementation-foundation`. Research checkpoint: `836c8ab`; implementation checkpoints: `1e85b0c`, `31defed`, `7f11a91`, followed by the review fix commit.

## Delivered

- Node 26.13.1 deployment baseline, Node 24 compatibility; TypeScript 6.0.3; strict peer/engine installation. API, service/package and frontend checking; CI matrix for both Node versions with SHA-pinned Actions.
- React/DOM 19.3.1, Router 7.18.5, Vite 8.3.8 and the selected compatible build plugins/types. Two nullable ref annotations and explicit CSS font imports; existing routes/API shapes retained.
- Schema-derived strict `WebEventV1` and compiled validation; pageviews and bounded named events; unknown fields and controls rejected. Versioned SHA-256 tuple receipt identities scoped by tenant/site/event, with UUID casing normalized.
- Strict compiler flags and type-aware lint for the new ingestion package. `npm run check` combines type checks, lint, formatting, tests and build.

## Verification

| Check | Observed result |
|---|---|
| Baseline before migration | 19/19 tests; production build passed. |
| Clean install | `npm ci` passed with strict peer/engine resolution. |
| Final Node 26.13.1 / npm 11.20.0 | `npm run check`: 32/32 tests, types/lint/format/build passed. |
| Final Node 24.19.0 / npm 11.17.0 | `npm run check`: 32/32 tests, types/lint/format/build passed. |
| Initial test-first baseline | Minimal parser/receipt stubs produced six assertion failures; all 12 initial new tests passed after implementation. |
| API check negative control | Temporary bad API assignment rejected by root `typecheck`. |
| Compiler negative controls | Independent unchecked array, explicit undefined optional and enum cases rejected: TS2322, TS2375, TS1294. |
| Promise lint negative controls | Both unhandled and `void`-discarded promises rejected by `no-floating-promises`; temporary files removed. |
| Browser — Chrome 157.0.8103.51 | `/`, `/demo`, `/operator`, `/p/stellarcope`, `/docs` rendered with zero uncaught errors. Worktree `dist`, synthetic APIs, external requests blocked. |
| Normal-motion browser | Initially hidden reveal; scrolling produced an intermediate count then completed reveal/count, zero uncaught errors. Forced reduced-motion negative control failed as required. |
| Unicode regression | C1 controls U+0080/U+0085/U+009F in middle/end of paths accepted before fix and rejected afterward; suite rose to 32 tests. |

Reproduce with the selected runtime on PATH:

```sh
npm ci
npm run check
npm ci --prefix experiments/stack --ignore-scripts
STELLARCOPE_BROWSER_ROOT="$PWD/dist" node experiments/stack/browser.mjs
```

The isolated browser tool expects local Google Chrome at its documented macOS path. Browser output/screenshots are ignored local artifacts under `experiments/stack/results/browser/`. CI is configured; no remote GitHub run was triggered. Historical lab hashes describe the original experimental fixtures/harness, not this modified browser script.

TypeScript 6's new side-effect import check exposed bare font CSS package imports; explicit `/index.css` imports fix resolution without disabling the check. See the [official release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html). CI action pins were verified from the official [checkout release](https://github.com/actions/checkout/releases/tag/v7.0.1) and [setup-node release](https://github.com/actions/setup-node/releases/tag/v7.1.0).

The existing bundle-size advisory remains. Frontend JavaScript gzip increased from 183.79 kB to 207.36 kB after migration. Route splitting/performance work remains a later measured improvement, not part of this foundation batch.

## Review and dispositions

A fresh reviewer inspected the foundation commit range and ran focused parser probes. Two Important findings were fixed with failing regression checks first: C1 controls and reduced-motion-only browser coverage. No Critical or Minor findings were reported. The complete checks passed on both runtimes after fixes.

The review set aside admission privacy/authorization and durable publication/worker/Umami/tracker behavior as later roadmap work. The parser remains disconnected from live ingestion. Privacy and authority checks must precede endpoint activation; managed publication and transactional worker effects must precede any durable acknowledgement claim. Existing legacy collection remains best effort. No availability target has been established by these local tests.

## Execution rulings

1. Execute the three shared-dependency foundation tasks inline; later rollout steps receive separate executable plans. Cost if wrong: revise batch boundaries before subsequent implementation.
2. Keep plans under `engineering/plans` because `/docs` is ignored. Cost if wrong: documentation links need relocation.
3. Verify config/type-only migrations with real suites and disposable canaries; apply test-first checks to domain behavior. Cost if wrong: a configuration regression outside these checks would require another targeted check.
4. Engines allow Node 24 or 26 and exclude EOL Node 25. Cost: unsupported Node 25 installs intentionally fail.
5. Keep admission privacy/authorization for the later admission layer while this parser is disconnected. Cost of premature activation: personal-data storage or tenant spoofing.
6. Keep durable publication/worker/Umami/tracker delivery for later steps and expose no new durability claim here. Cost of a premature claim: misleading data-loss guarantees.

## Next boundary

Roadmap step 4: Fastify app composition, separate private listener, validated configuration and health endpoints. Test invalid startup configuration, body/decoded limits, public-to-private route isolation and response redaction before connecting storage or queue publication. Step 5 separately establishes real PostgreSQL migrations and tenant transaction/RLS tests. No cloud resources were provisioned, production data migrated, or changes pushed/merged.
