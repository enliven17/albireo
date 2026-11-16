# Engineering guide

## Current implementation

The selected direction is **Umami internally behind Stellarcope**, a stateless Collector admission path, managed web/metric queues and PostgreSQL-backed idempotent effects/rollups. The [technical baseline](2026-11-15-decisions.md) records the decisions and tradeoffs. The [roadmap](plans/2026-11-15-rollout.md) separates delivered steps from future integrations.

| Component | Status | Entry point |
|---|---|---|
| Runtime/frontend/contracts | Implemented and tested | [Foundation results](plans/2026-11-15-foundation-results.md) |
| Security maintenance | Patched dependency graphs and service-image definitions; dated scans must be repeated | [Maintained images](../infra/images/README.md) |
| Fastify skeleton | Implemented; readiness/admission remain disabled | [Ingress guide](ingress.md), [step-4 plan](plans/2026-11-16-ingress.md) |
| Legacy application | Prototype remains separate | [Repository overview](../README.md) |
| Production persistence, access and queues | Pending; no cloud deployment | [Steps 5–22](plans/2026-11-15-rollout.md) |

For backend work, run `npm ci` and `npm run check` using the maintained Node version. New service/package code receives strict indexed/optional checking, typed lint and formatting; the frontend and Node compiler configurations stay distinct. [Contribution conventions](../CONTRIBUTING.md) apply to branches and commits.

## Reading order

1. [Ingress operation and boundary contract](ingress.md): exact local commands, route/config tables, isolation, limits and shutdown.
2. [Selected technical baseline](2026-11-15-decisions.md): current architecture, ownership, failure semantics and coding practices.
3. [Implementation roadmap](plans/2026-11-15-rollout.md): prerequisites and concrete acceptance gates for subsequent steps.
4. [Maintained service images](../infra/images/README.md): reproducible build definitions and upstream coupling.

## Experiments and historical evidence

- [Stack decision lab](../experiments/stack/README.md) and [findings](../experiments/stack/FINDINGS.md): package compatibility, schemas, real migrations/Umami reporting, signed identities, queue admission and histogram assumptions.
- [Reliability lab](../experiments/reliability/README.md) and [findings](../experiments/reliability/FINDINGS.md): retries/duplicates, database/process failures, persistence limits and transaction/RLS patterns.
- [Initial service advisory review](security/2026-11-15/README.md): pre-remediation package/image findings at its recorded revision. The active definitions and locks were subsequently patched.
- [Original architecture proposal](2026-11-15-architecture.md) and [stack research](2026-11-15-stack-research.md): dated background, superseded wherever they conflict with the selected baseline.

Experiments are separate fixtures, not production handlers or proof of the availability targets. Old results identify their original source/image hashes; changed artifacts require fresh verification. Never import the labs' token-issuance, message-consumption or failure-control endpoints into application services.

Documentation lives in `engineering/` because `/docs` is ignored; `src/docs/` is the separately rendered prototype documentation. Feature work in this batch stops at roadmap step 4. The next implementation batch would start with production migrations and tenant transaction isolation, after a separate instruction to continue.
