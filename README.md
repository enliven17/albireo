<p align="center"><img src="brand/logo/lockup-color.png" alt="Stellarcope" width="360"></p>

<p align="center">Web and API analytics for the Stellar ecosystem.</p>

Stellarcope targets the Stellar Community Fund RFP **Web and API Analytics for Stellar Ecosystem Projects**. The intended service combines internal Umami web analytics, OpenTelemetry-derived API metrics, verified project enrollment and verifiable daily summaries.

## Implementation status

This repository contains a working legacy prototype, a tested build/dependency baseline, and the first production-service foundations. The complete production architecture is still being implemented.

| Area | Current state |
|---|---|
| Legacy web prototype | Tracker, filtering, custom PostgreSQL reports, dashboards and operator/public-card UI are present. Legacy 202 responses do not prove durable acceptance. |
| Seals and proofs | Merkle summaries, inclusion proofs and Stellar anchoring code are present. Local tests verify signing with controlled Horizon responses. |
| New event contract | Strict versioned web payload validation and tenant/site-scoped receipt identities are implemented. |
| New ingress skeleton | Separate public/private Fastify listeners, configuration validation, health, body limits, generic errors and shutdown are implemented. Readiness remains 503; ingestion placeholders accept no data. |
| Production integrations | Managed queues, transactional Umami workers, tenant authorization/enrollment, OTLP persistence/rollups, retention/erasure and cloud operations remain roadmap work. |

The current legacy application uses its own collection/reporting SQL. The Umami and Collector experiments verify integration assumptions; they are separate from production application code. Availability targets and end-to-end privacy/tenant guarantees require the later implementation and operational gates.

Start with the [engineering guide](engineering/README.md), [ingress operations](engineering/ingress.md), [selected architecture](engineering/2026-11-15-decisions.md) and [implementation roadmap](engineering/plans/2026-11-15-rollout.md).

## Local development

Use Node **26.13.1** from [.node-version](.node-version), or the tested compatibility floor **24.22.3**. Lockfiles, engine requirements and strict peer checks are enforced.

```sh
npm ci
npm run check          # types, lint, formatting, local tests and build
npm run dev            # Vite frontend on localhost:5173
```

Both frontend development and preview proxy `/api` requests to the remote prototype configured in [vite.config.ts](vite.config.ts). They are not fully local backend environments. The automated tests use controlled fixtures/local servers; they do not need a live database, Docker or Stellar submission credentials.

Run the new, independent service in another terminal:

```sh
npm run start:ingress
curl -i http://127.0.0.1:8080/health/live     # 200
curl -i http://127.0.0.1:8080/health/ready    # 503: admission is not implemented
```

No database or broker credentials are required. See the [configuration and route tables](engineering/ingress.md) before changing bindings or sending test payloads. The existing standalone collector also defaults to port 8080; use separate ports when running both.

## Repository map

```text
packages/ingestion  new strict web contract and receipt identity
services/ingress   new Fastify skeleton; no data acceptance yet
packages/core      legacy normalization, filtering, hashes, seals and histograms
packages/tracker   versioned browser tracker
packages/swk       Stellar Wallets Kit funnel wrapper
services/collector legacy web collector and local spool
services/writer    legacy spool-to-PostgreSQL writer
services/api       prototype reports, seals and proofs
services/verifier  prototype SEP-1, DNS and meta verification helpers
api/               legacy Vercel function entry points
src/               landing, dashboards and rendered prototype documentation
infra/images       maintained service/test-image definitions
experiments/       disposable compatibility and failure experiments
engineering/       architecture, plans, status and developer guides
db/schema.sql      legacy database schema; production migrations are a later step
```

The local spool is a prototype buffer, not a highly available durable queue. It can lose buffered work on restart, and the legacy writer's commit/delete boundary can duplicate effects. The planned managed queues and transactional receipt workers address those separate boundaries.

## Verification and operator commands

`npm run check` is the main developer gate. [Contribution conventions](CONTRIBUTING.md) define branch/commit names. The [service-image guide](infra/images/README.md) and [experiments](engineering/README.md#experiments-and-historical-evidence) describe Docker-based checks and their limits. Security scans are dated observations; repeat advisory/image checks when artifacts change.

`npm run seed` is a legacy operator command: it reads `.env.local`, writes the configured database, and performs domain verification. It requires `DATABASE_URL` and `VERIFY_TOKEN`; it is not part of the local quickstart. Anchoring additionally requires operator-managed Stellar credentials and network configuration.

## Prototype links

[Dashboard](https://stellarcope.xyz/demo) · [Operator view](https://stellarcope.xyz/operator) · [Public card](https://stellarcope.xyz/p/stellarcope) · [Rendered prototype docs](https://stellarcope.xyz/docs)

These are prototype deployment links. Local verification does not establish their deployed revision or current availability.

## License

MIT
