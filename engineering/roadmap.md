# Roadmap

What Stellarcope does today, and what each milestone adds. The [technical architecture](technical-architecture.md) describes the target system. The milestones correspond to the tranches of the SCF RFP award.

## Today

- **Live prototype** at [stellarcope.xyz](https://stellarcope.xyz):
  - a browser tracker and collector
  - tenant dashboards, an operator view and public project cards
  - daily Merkle summaries anchored on Stellar testnet
- **Production foundations:**
  - a strict, versioned web event contract with tenant- and site-scoped receipt identities
  - the [ingress service](ingress.md), with isolated public and private listeners (admission not yet enabled)
  - a Node 26 and TypeScript 6 baseline with typed linting
  - [maintained service images](../infra/images/README.md)
- **Validated designs** from the [stack lab](../experiments/stack/FINDINGS.md) and [reliability lab](../experiments/reliability/FINDINGS.md):
  - duplicate-safe writes into Umami's schema
  - OpenTelemetry delivery through a queue
  - cumulative-metric reconstruction
  - behavior under restarts and database outages

## Milestone 1: Web analytics (target February 2027)

- Tenant-isolated PostgreSQL with row-level security.
- Wallet login (SEP-10), self-service enrollment and domain verification (stellar.toml, DNS or meta tag).
- A version-pinned tracker with an integrity hash, ingested exactly once into Umami through a durable queue.
- A private tenant web dashboard with all seven RFP metrics.

## Milestone 2: API analytics, onchain activity and operator tools (target April 2027)

- **OpenTelemetry ingestion:** signed ingest credentials; traces, spans and logs are dropped.
- **API metrics:** route normalization, correct rollups for late and cumulative data, and p50/p95 latency per route.
- **Onchain activity** for each project's registered accounts and contracts.
- **SCF operator console:** global comparison, project removal, approval-required enrollment and revocable metrics API keys.
- **Bot and inflation defenses** built on Umami's own detection.
- **Data lifecycle:** retention and tenant-triggered erasure.
- **Event capture:** Stellar Wallets Kit events and custom events.
- **Security planning:** a STRIDE threat model and an onchain monitoring plan.

## Milestone 3: Production on mainnet (target June 2027)

- **Production in the EU:** AWS Frankfurt across three availability zones, with a serverless standby intake in Ireland, defined entirely in OpenTofu.
- **Validated resilience:** load tested at the design target of about 1,000,000 requests per day, with zone, region, release and restore drills.
- **Mainnet:** SEP-10 login and daily seals on Stellar mainnet.
- **Documentation:** onboarding, security, privacy and compliance.
- **Live adoption:** at least three SCF-awarded projects on web analytics and one on API analytics.
- **Operations:** runbooks and a handover plan.

## Service and handover (twelve months after Milestone 3)

| Commitment | Target |
|---|---|
| Ingestion availability | 99.99% |
| Dashboard availability | 99.90% |
| Critical and high vulnerabilities | Patched within 24 hours |
| Support tickets | Answered within 5 business days, resolved within 10 |

Ingestion availability is measured by independent external checks every minute, as defined in the [technical architecture](technical-architecture.md#8-reliability-and-the-9999-commitment), and published monthly.

Stewardship passes to a community-appointed operator between months 6 and 12. The handover covers the repository, a full data migration, the domain, and the onchain anchor account.
