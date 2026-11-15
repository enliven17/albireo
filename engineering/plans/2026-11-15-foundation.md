# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the selected runtime/build baseline and the first production ingestion contract without changing live ingestion behavior.

**Architecture:** Preserve the current application while upgrading its tested dependency baseline. Add an isolated strict ingestion package for the forthcoming Fastify admission path; migrate deployment and persistence in later roadmap steps.

**Tech Stack:** Node 26.13.1; TypeScript 6.0.3; React/DOM 19.3.1; Router 7.18.5; Vite 8.3.8; React plugin 6.3.0; Tailwind Vite plugin 4.3.5; TypeBox 1.4.7; ESLint 10.15.0/typescript-eslint 8.72.2; Prettier 3.10.1.

**Spec:** [Selected technical baseline](../2026-11-15-decisions.md); [rollout roadmap](2026-11-15-rollout.md).

## Global Constraints

- Deploy on Node 26.13.1; retain Node 24 as the tested compatibility floor. Use TypeScript 6.0.3, not forced TS 7 peer resolution.
- New/migrated backend code uses `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `erasableSyntaxOnly`, and explicit type imports.
- Keep frontend bundler and Node module configurations distinct; type-check `api/` as well as services/packages.
- Preserve existing tracker URLs and current API behavior in this batch; do not activate unimplemented queue adapters or imply durable current 202 responses.
- No cloud deployment, push, merge, production data migration or secrets copied into fixtures. Local commits are reviewable checkpoints.
- Keep research/experiments as evidence; never import experimental handlers/control endpoints into production modules.

## Review Focus

- A dependency upgrade compiles but prevents native `.ts` execution: run the complete suite on the selected Node binary (Tasks 1–2).
- API routes silently escape type checking: include the API tsconfig and verify a temporary bad API assignment is rejected (Task 1).
- React 19 ref types compile but the UI fails at runtime: five local browser routes with synthetic API responses and blocked external traffic (Task 2).
- A client supplies tenant authority or personal extras: strict unknown-field rejection on raw web payloads (Task 3).
- Concatenated IDs collide or tenant context is omitted: shared event UUID across different tenant/site pairs must produce distinct receipt IDs (Task 3).

---

### Task 1: Runtime, compiler and complete checking

**Files:** Modify `package.json`, `package-lock.json`, `tsconfig.node.json`, `packages/core/session.ts`, `src/main.tsx`; create `.node-version`, `.npmrc`, `.github/workflows/ci.yml`.

**Interfaces:** Consumes the current 19-test suite and frontend/API tsconfigs. Produces `npm run typecheck` covering all three configurations and a reproducible Node 26/TS 6 installation. No domain API changes.

- [x] Verify the existing baseline with `npm test` and `npm run build` before dependency changes. Expected: 19 passing tests and successful build.
- [x] Pin TypeScript 6.0.3, `@types/node` 24.19.2 and `@types/pg` 8.23.1, matching the compatibility-floor types tested in the lab. Set Node engines `^24.0.0 || ^26.0.0` (LTS lines only), npm package-manager version from the verified Node 26 distribution, `.node-version` to `26.13.1`, and strict engine/peer installation in `.npmrc`.
- [x] Add `erasableSyntaxOnly` to Node checking and preserve the explicit `Buffer` annotation needed by the newer Node types. Extend `typecheck` to run frontend, service/package and API configs with `--noEmit` where needed.
- [x] Create a temporary API file assigning a string to `number`, run `npm run typecheck`, verify nonzero exit and that file's diagnostic, then remove only the temporary file. This is a disposable canary, not a permanent source-text test.
- [x] Add CI using Node 26.13.1, `npm ci`, `npm run typecheck`, `npm test`, and `npm run build`. CI does not run seed scripts or contact the live data proxy.
- [x] Run the complete suite/check/build on Node 26; verify the working tree only contains intended dependency/type/config changes. Expected: 19 passing tests, no type/build errors.
- [x] Commit: `build: establish Node 26 and TypeScript 6 baseline`.

### Task 2: Tested frontend package migration

**Files:** Modify `package.json`, `package-lock.json`, `src/lib/reveal.ts`. Use the existing isolated browser harness as a test tool, never a production dependency.

**Interfaces:** Consumes Task 1's runtime/check commands. Produces the same frontend routes and API client shapes under the selected React/Vite stack.

- [x] Upgrade React/DOM to 19.3.1, Router to 7.18.5, Vite to 8.3.8, React plugin to 6.3.0, Tailwind Vite plugin to 4.3.5, and React/DOM types to 19.3.0, retaining other application dependencies unless required for compatibility.
- [x] Run type checking before fixing React ref signatures; confirm the expected nullable-ref errors. Update only the two `RefObject<HTMLElement | null>` signatures already proven in the experiment.
- [x] Run `npm run typecheck && npm test && npm run build`. Expected: complete checking, 19 passing tests and a successful build.
- [x] Run the browser smoke harness against **this worktree's built assets**, not the experiment snapshot: `/`, `/demo`, `/operator`, `/p/albireo`, `/docs`. Expected: each renders, no uncaught errors, synthetic API fixtures only, all external requests blocked. Parameterize the existing harness's static root if needed; preserve its default snapshot behavior.
- [x] Verify generated assets are not staged and current tracker build files have not changed unexpectedly. Commit: `build: migrate the tested frontend package set`.

### Task 3: Strict first production web contract

**Files:** Create `packages/ingestion/{package.json,tsconfig.json,web.ts,web.test.ts,identity.ts,identity.test.ts}`, `eslint.config.mjs`, `.prettierrc.json`; modify root package scripts/dependencies and CI.

**Interfaces:** Consumes Node checking from Task 1. Produces `WebEventV1Schema`, inferred `WebEventV1`, `parseWebEvent(input: unknown): WebEventV1 | null`, and `webReceiptId(tenantId: string, siteId: string, eventId: string): string`. Later admission code resolves tenant/site authority and sanitizes values; this parser is structural validation, not the complete privacy layer.

- [x] Write tests first: valid pageview/custom event round-trip; custom event requires a bounded name; reject wrong/missing version, malformed UUID, missing site, unknown type, tenant/wallet extras, query/fragment/control characters, oversized path/name, non-object input, and pageview carrying a custom name. Hand-written valid fixture: `{ version: 1, siteId: 'albireo', eventId: '9d94ec7c-b593-4632-9880-19d87b7a2875', type: 'pageview', path: '/swap' }`.
- [x] Add only minimal export stubs needed to run assertions, then run `node --test packages/ingestion/web.test.ts`. Expected: assertions fail because the parser does not validate/accept the contract yet; keep that red result in the execution record.
- [x] Implement the TypeBox discriminated union: literal version 1; site ID 1–64 ASCII letters/digits/underscore/hyphen; UUID event ID; absolute path 1–256 characters with no `//` prefix, query, fragment, spaces or controls; pageview without name, custom event with name 1–64 ASCII letters/digits/underscore/dot/colon/hyphen starting with a letter. Reject extra properties. Retain schema-derived types and compiled validation; do not duplicate a handwritten interface.
- [x] Run parser tests and the complete suite. Expected: all pass. Keep optional metadata out until the privacy/preparation task defines and tests each field; unknown fields fail visibly in this initial new protocol.
- [x] Write receipt-identity tests first: deterministic 64-character hexadecimal output, same event in different tenants/sites differs, concatenation-ambiguous tenant/site strings do not collide, empty/control/oversized context rejected. Run red, then implement SHA-256 of an unambiguous versioned JSON tuple with validated context. This is an idempotency receipt key, not authentication or a content fingerprint.
- [x] Add the package's strict Node tsconfig and include it in root `typecheck`. Add ESLint recommended type-checked rules, `projectService`, consistent type imports, and `no-floating-promises` with `ignoreVoid: false`; limit this initial lint/format scope to the new package. Pin the selected tool versions and run checks in CI.
- [x] Verify the lint rule using a temporary unhandled promise in the new package: expected nonzero lint result naming `no-floating-promises`; remove the temporary file. Verify the stricter indexed-read/optional-property settings with temporary compile-error canaries; remove them after observing failure.
- [x] Run `npm run check` (typecheck, lint, formatting, complete tests, build). Expected: all checks pass, existing routes/trackers unchanged.
- [x] Commit: `feat: add strict web ingestion contracts and receipt identities`.

## Completion and handoff

- Record each task's commands, red/green evidence, commit and deviations in the execution ledger.
- Review the whole foundation branch against this plan/spec with a fresh reviewer; fix material findings with regression tests, then rerun the full checks.
- Keep the worktree and branch for the next roadmap step; do not merge/push/deploy without the user's instruction.
- This batch does not implement the production queue, authorization registry, Umami worker, OTLP ledger, or SLO claim. Their dependencies and acceptance tests are in the roadmap, not silently represented as delivered.
