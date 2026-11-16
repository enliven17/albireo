# Stack and architecture decision lab

Disposable compatibility, everyday-practice, and architecture tests for the [selected baseline](../../engineering/2026-11-15-decisions.md). The initial experiment left application dependencies unchanged. Active fixtures now use the [maintained service images](../../infra/images/README.md) and refreshed locks; the original findings remain historical evidence.

See the [measured findings](FINDINGS.md) for decisions and evidence boundaries.

## Reproduce

Docker Desktop and the repository's existing dependencies are prerequisites. The browser check uses installed Google Chrome at `/Applications/Google Chrome.app`. Do not run simultaneous copies: ports 33529, 43329 and 43429 are fixed loopback bindings.

```sh
cd experiments/stack
npm ci --ignore-scripts --strict-peer-deps
npm install --prefix tooling7 --ignore-scripts typescript@7.0.2
node prepare-snapshot.mjs
npm ci --prefix snapshot --ignore-scripts --strict-peer-deps
node run.mjs
```

`prepare-snapshot.mjs` copies only named source/assets, applies the candidate versions and three type-annotation migrations, and leaves the application untouched. It restores the retained `frontend.package-lock.json` so the tested frontend graph is reproducible. It never copies environment files or git state. Its generated snapshot and node_modules are ignored.

Pinned Umami helpers are retained under `upstream/` with their MIT license and original SHA-256 hashes. They are compiled separately with upstream-compatible settings; only relative import extensions change. To regenerate them, clone Umami v3.5.0 and run `UMAMI_SOURCE=/path/to/clone node prepare-upstream.mjs`. The helper extraction is a compatibility experiment, not a separately invented session algorithm.

## Coverage

- Strict compiler flags, real type-aware linting, formatter checks, and negative promise/type controls.
- TS 7 type-check comparison and expected strict peer-resolution rejection against the current lint package.
- Node 24 and 26 execution; upgraded app build and existing 19 tests on Node 26.
- TypeBox versus Zod: input behavior, inferred response contracts and generated OpenAPI validation. Timings are local microbenchmarks only.
- JWT required claims, expiration, tenant attribution, beacon parsing, bounded bodies, response redaction, cancellation, and publish-before-ack.
- Real PostgreSQL 17.12: migration/no-op, full histogram-vector checkpoints, concurrent writers/retries, rollback, epochs/layouts, unknown baselines, large integer preservation, and ordered reconstruction after late delivery.
- Actual pinned Umami resolver and SDK 17.4 SEP-10/transaction signing without a network.
- Actual Umami 3.5 schema and reporting API: transactional page/custom events, properties, duplicate replay, cross-site event-key reuse, conflicts and rollback. This is a **narrow private-schema adapter proof**, not complete production ingestion.
- Real Collector and AWS SDK with local ElasticMQ: verified tenant binding, missing-claim rejection, database outage, restart without a local queue, response loss, actual Protobuf/gzip export, decoded-size limits, bounded large-request packing/partial retry, a 1000-request burst, and broker outage propagation.
- Five frontend routes in headless Chrome, with synthetic API data and all external requests blocked.

## Evidence and limits

Each run saves logs, selected package versions, image identities, fixture hashes, dependency-lock hashes and results under ignored `results/<timestamp>/`. The [retained evidence snapshot](evidence/2026-11-15.json) records the final decision run. Browser screenshots/results remain in ignored `results/browser/`.

Each integration run uses a unique `stellarcope-stack-<timestamp>` Compose project, removes only that project's resources, and uses disposable credentials/data. It does not contact the production site or create AWS resources. The runtime advisory query is separately retained under `results/dependency-audit.json`.

The HTTP relay is deliberately a loopback-exposed **test fixture**, with control/token/consume routes and synthetic identity provisioning. Production must enforce its private trust boundary, credential registry, complete schema normalization, and worker acknowledgement after database commit. `/consume` deletes emulator messages to inspect transport behavior; it is not the production database worker.

ElasticMQ is an in-memory SQS-compatible emulator. These tests establish client/pipeline behavior, not AWS persistence, IAM, AZ survival, service availability, cost or regional performance. Node 24 unit execution intentionally skips the database/Umami cases; the Node 26 integration execution supplies both services and runs them. The 1000-request burst is a bounded local check, not sustained capacity or a four-nines SLO proof.

The complete implementation still needs actual authorization-registry rotation/revocation, final normalized OTLP profile validation and rollup repair/retention, production privacy/erasure, deployment/restore and cloud acceptance tests. Those are named implementation obligations in the decision document; none is silently counted as completed by these fixtures.
