<a href="https://stellarcope.xyz"><img src="docs/readme/banner.png" alt="Stellarcope: every number, verified. Trusted, privacy-first web and API analytics for Stellar." width="100%"></a>

<p align="center">Web and API analytics for the Stellar ecosystem.</p>

<p align="center">
  <a href="https://stellarcope.xyz"><img alt="Live prototype" src="https://img.shields.io/badge/live-stellarcope.xyz-FFA630?style=flat-square&labelColor=05060A"></a>
  <a href="https://stellarcope.xyz/docs"><img alt="Docs" src="https://img.shields.io/badge/docs-prototype-6E9BFF?style=flat-square&labelColor=05060A"></a>
  <img alt="Node 26.13.1 or 24.22.3" src="https://img.shields.io/badge/node-26.13.1%20%7C%2024.22.3-ECEAE4?style=flat-square&labelColor=05060A">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-6E9BFF?style=flat-square&labelColor=05060A">
  <img alt="Sealed on Stellar testnet" src="https://img.shields.io/badge/sealed%20on-Stellar%20testnet-FFA630?style=flat-square&labelColor=05060A">
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-8B90A0?style=flat-square&labelColor=05060A"></a>
</p>

<p align="center">
  <a href="https://stellarcope.xyz/demo"><b>Dashboard</b></a> ·
  <a href="https://stellarcope.xyz/p/stellarcope"><b>Public card</b></a> ·
  <a href="https://stellarcope.xyz/docs"><b>Docs</b></a> ·
  <a href="engineering/README.md"><b>Engineering guide</b></a> ·
  <a href="brand/README.md"><b>Brand kit</b></a>
</p>

<br>

<table>
  <tr>
    <td width="50%" valign="top"><img src="docs/readme/dashboard.webp" alt="Tenant dashboard with visitors, page views, bounce rate and average visit"><p align="center"><sub><b>Tenant dashboard</b> · web, API, wallet funnel and trust tabs</sub></p></td>
    <td width="50%" valign="top"><img src="docs/readme/public-card.webp" alt="Public card with trust score, 30 day visitors and API requests, verification checks and onchain proof"><p align="center"><sub><b>Public card</b> · verification checks and the onchain proof</sub></p></td>
  </tr>
</table>

<table>
  <tr>
    <td width="33%" align="center"><b>Web analytics</b><br><sub>Cookieless page analytics, custom events and the Stellar Wallets Kit funnel</sub></td>
    <td width="33%" align="center"><b>API analytics</b><br><sub>OpenTelemetry-derived counters and latency histograms, dual exported next to your APM</sub></td>
    <td width="33%" align="center"><b>Daily seals</b><br><sub>Merkle summaries anchored on Stellar so reviewers can check what they read</sub></td>
  </tr>
</table>

Stellarcope targets the Stellar Community Fund RFP **Web and API Analytics for Stellar Ecosystem Projects**. The intended service combines internal Umami web analytics, OpenTelemetry-derived API metrics, verified project enrollment and verifiable daily summaries.

## Implementation status

This repository contains a working legacy prototype, a tested build/dependency baseline, and the first production-service foundations. The complete production architecture is still being implemented.

| | Area | Current state |
|:-:|---|---|
| 🟢 | Legacy web prototype | Tracker, filtering, custom PostgreSQL reports, dashboards and operator/public-card UI are present. Legacy 202 responses do not prove durable acceptance. |
| 🟢 | Seals and proofs | Merkle summaries, inclusion proofs and Stellar anchoring code are present. Local tests verify signing with controlled Horizon responses. |
| 🟢 | New event contract | Strict versioned web payload validation and tenant/site-scoped receipt identities are implemented. |
| 🟡 | New ingress skeleton | Separate public/private Fastify listeners, configuration validation, health, body limits, generic errors and shutdown are implemented. Readiness remains 503; ingestion placeholders accept no data. |
| ⚪ | Production integrations | Managed queues, transactional Umami workers, tenant authorization/enrollment, OTLP persistence/rollups, retention/erasure and cloud operations remain roadmap work. |

<sub>🟢 implemented in this repository · 🟡 skeleton, accepts no data yet · ⚪ roadmap</sub>

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

## How the pieces fit

This diagram restates the repository map below: the legacy prototype path that runs today, and the new foundations being built next to it.

```mermaid
flowchart LR
  subgraph site["Project website"]
    W["packages/swk<br/>wallet funnel"]
    T["packages/tracker<br/>browser tracker"]
  end
  subgraph legacy["Legacy prototype"]
    C["services/collector<br/>web collector + local spool"]
    WR["services/writer<br/>spool to PostgreSQL"]
    DB[("PostgreSQL<br/>db/schema.sql")]
    API["services/api<br/>reports, seals, proofs"]
    V["services/verifier<br/>SEP-1, DNS, meta"]
  end
  subgraph next["New foundations"]
    ING["packages/ingestion<br/>strict web contract"]
    IN["services/ingress<br/>Fastify skeleton, no data yet"]
  end
  S{{"Stellar<br/>manage_data anchor"}}
  UI["src/<br/>dashboards and public card"]
  W --> T --> C --> WR --> DB --> API
  V --> DB
  API -- daily Merkle root --> S
  API --> UI
  ING -.-> IN
  classDef gold fill:#1a1408,stroke:#FFA630,color:#ECEAE4
  classDef blue fill:#0b1226,stroke:#6E9BFF,color:#ECEAE4
  classDef dim fill:#0B0D14,stroke:#565B69,color:#8B90A0
  class T,W,C,WR,DB,API,V,UI gold
  class S blue
  class ING,IN dim
```

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

<a href="https://stellarcope.xyz"><img src="docs/readme/landing.webp" alt="Stellarcope landing page" width="100%"></a>

[Dashboard](https://stellarcope.xyz/demo) · [Operator view](https://stellarcope.xyz/operator) · [Public card](https://stellarcope.xyz/p/stellarcope) · [Rendered prototype docs](https://stellarcope.xyz/docs)

These are prototype deployment links. Local verification does not establish their deployed revision or current availability.

## License

MIT
