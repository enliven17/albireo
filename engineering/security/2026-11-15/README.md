# Service and dependency advisory review — 2026-11-15

**Result: there are open security findings. An all-clear is not supported.** This is a current dependency/service advisory review, not a complete source-code audit or a penetration test. No vulnerable service was attacked or production deployment changed.

Repository baseline: `d2e5280`. Current branch: `feat/implementation-foundation`, renamed from the former tool-prefixed branch at the user's request. New branch/commit conventions are in [CONTRIBUTING.md](../../../CONTRIBUTING.md).

## Method and coverage

- Queried npm's live advisory service against the actual application and selected-stack lockfiles, both full graphs and `--omit=dev`. Audited the archived frontend lockfile separately without changing the original. Exact lockfile hashes are in [the inventory](lockfile-inventory.json).
- Downloaded official Trivy **0.76.2** and verified its release checksum: `ae7ea358326960406b703c77b2ac490190797d80b306b5b50c2a27221da0a5b8`. Refreshed its database; database update time is **2026-11-15T18:56:37Z**, download time **20:07:29Z**, recorded in [database metadata](trivy-db-metadata.json).
- Scanned six existing Linux/arm64 images by their actual local image identities. All six completed. The sink's first scan hit a local cache lock; its standalone retry succeeded. [Image identities/status](image-scan-status.json) include report hashes. No unrelated workspace images were assessed.
- Compared package matches with vendor advisories, affected ranges, package paths, architecture and enabled Collector configuration. Scanner severity/counts are preserved; they are not all proven remotely reachable application defects.
- Planned AWS services have no Stellarcope deployment to inspect. Their public bulletins and implementation obligations are discussed below; no AWS account, IAM, security-group or deployed-engine review was performed.

## npm results

These are **affected-package counts**, including parents flagged through a dependency, not counts of independent CVEs.

| Graph | High | Moderate | Critical | Interpretation |
|---|---:|---:|---:|---|
| [Current application, all dependencies](application-npm-audit.json) | 3 | 7 | 0 | Old Stellar SDK/TOML, sharp, nested minimatch and dependent lint packages. |
| [Current application, runtime only](application-runtime-npm-audit.json) | 2 | 0 | 0 | `@stellar/stellar-sdk@13.1.0` and `toml@3.0.0` are one dependency chain. |
| [Selected-stack experiment, all dependencies](stack-lab-npm-audit.json) | 0 | 9 | 0 | Nested minimatch/glob, lint packages and migration tooling. |
| [Selected-stack experiment, runtime only](stack-lab-runtime-npm-audit.json) | 0 | 0 | 0 | No npm matches for this graph at query time. This excludes image contents and dev/operational tools. |
| [Archived frontend dependency graph](frontend-snapshot-npm-audit.json) | 1 | 0 | 0 | Historical sharp dependency remains flagged. This graph is evidence, not the current application. |

### Current application: Stellar SDK / TOML

`@stellar/stellar-sdk@13.1.0` pulls in `toml@3.0.0`. Advisory matches include prototype pollution and resource-exhaustion issues, including [CVE-2026-114142](https://github.com/advisories/GHSA-h895-cgqg-jf52), plus the other TOML advisories in the saved audit. A prototype-pollution payload can change shared JavaScript object behavior when a vulnerable parser processes it.

This is a confirmed dependency match, not a demonstrated attack through Stellarcope: the current SDK call site in `services/api/seal.ts` submits Stellar transactions, while `services/verifier/verify.ts` uses its own account extractor. I did not establish that the SDK's vulnerable TOML resolver is called on attacker input today. It is still unsuitable to carry this old dependency chain into the planned SEP-10/domain implementation.

The selected `@stellar/stellar-sdk@17.4.0` experiment has no runtime npm matches. Move the actual application to the selected SDK with seal/signing and SEP-10/domain tests, then repeat the runtime audit. Do not override the old SDK to a new TOML major blindly.

### Development and migration tooling

- `sharp@0.33.5` matches vulnerabilities in bundled libvips/libheif/librsvg. The audit's complete suggested target is **0.35.5**, including [the librsvg advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w). Its current use is the local branding script, not a public image-upload endpoint. Verify brand rendering/native installation after updating it; omit it from backend runtime images.
- Nested `minimatch@10.2.6` is affected by [CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249); the top-level `minimatch@11.0.8` is outside that range. The vulnerable copy sits under `@typescript-eslint/typescript-estree` and also `glob` in the experiment. The advisory identifies **11.0.1** as the fixed version.
- `node-pg-migrate@9.0.0` brings `glob@13.0.7`, matched by [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4). A migration tool is operational code even when classified as a dev dependency. Prefer patched upstream releases or a narrowly tested compatible resolution; verify real migrations and lint/compiler compatibility.
- The audit suggests some automatic *downgrades* of parent tooling. Do not run `npm audit fix --force`: it can undo the selected TypeScript-compatible stack without proving the dependency paths are fixed.

## Service images

Counts below are raw `(package, advisory)` matches and can repeat one CVE across packages. They include unused tooling and compiler-library matches. An empty OS result does not prove a statically compiled database engine is vulnerability-free.

| Image | Critical | High | Medium | Low | Unknown | Unique advisory IDs |
|---|---:|---:|---:|---:|---:|---:|
| Umami 3.5.0 | 0 | 4 | 6 | 3 | 0 | 13 |
| Collector Contrib 0.165.0 | 0 | 0 | 0 | 0 | 2 | 2 |
| PostgreSQL 17.12 Alpine | 1 | 25 | 31 | 3 | 2 | 62 |
| ElasticMQ native 1.7.1 | 2 | 18 | 22 | 32 | 0 | 39 |
| Stack lab / Node 26, full Bookworm image | 20 | 690 | 2,049 | 1,542 | 72 | 2,656 |
| Reliability sink / Node 24, full Bookworm image | 49 | 1,151 | 3,767 | 2,105 | 97 | 4,494 |

### Umami 3.5.0

[All image matches](umami-image-findings.json) identify:

- Four high matches in `undici@6.28.0` under **`usr/local/lib/node_modules/pnpm/dist/node_modules/undici`**, not Umami's application `node_modules`. For example, [CVE-2026-109383](https://github.com/nodejs/undici/security/advisories/GHSA-2m5v-pch6-74hx) affects custom TLS validation through Undici Agent; fixed versions include **6.29.1**. These are package-manager tooling matches, not proof that an external analytics request can trigger them. Update/remove the package manager from a runtime build if startup can work without it; test migrations/startup before changing the upstream image.
- Application `fast-uri@3.1.8` has four matches: CVE-2026-110180, CVE-2026-110306, CVE-2026-110095 and CVE-2026-110725. The matching branch's fixed version is **3.1.9**. Actual URI-validation use needs call-path validation; no exploit was demonstrated.
- Alpine `zlib@1.3.2-r1` matches CVE-2026-4738, fixed by **1.4-r0** in the scanner's vendor database. Prefer a refreshed upstream image or a tested rebuild with patched packages.

The recent critical [Reports API SQL-injection advisory GHSA-vhf9-rcmp-v5fc](https://github.com/umami-software/umami/security/advisories/GHSA-vhf9-rcmp-v5fc) currently declares affected versions **<=3.4.0**, and lists no patched version. **3.5.0 is outside the declared affected range**; do not label it affected by that advisory, or claim that the metadata proves 3.5.0 fixed the code. Keep the private boundary and least-privileged database role regardless. [Umami 3.5.0 release notes](https://github.com/umami-software/umami/releases/tag/v3.5.0) also describe changes to admin-password, 2FA, sharing and permission checks. These reinforce the need to test security behavior with each schema-coupled upgrade.

### OpenTelemetry Collector Contrib 0.165.0

[Image matches](collector-image-findings.json) identify two Go dependency/runtime advisories:

- **CVE-2026-97054 / [GO-2026-6859](https://pkg.go.dev/vuln/GO-2026-6859)**: the actual binary embeds Go **1.27.3**; the fixed line is **1.27.4** (or 1.26.11 on the older branch). An HTTP/1 handler that reads a limited body concurrently with writing response headers can panic. The public Collector uses HTTP, but that concurrency condition has not been established in its handler. Obtain a patched upstream build or validate the exact handler's reachability before accepting this build for production. Trivy's **UNKNOWN** severity is not a finding of no impact.
- **[GO-2026-5932](https://pkg.go.dev/vuln/GO-2026-5932)**: module `golang.org/x/crypto@v0.58.0` is matched against the unsafe, unmaintained `openpgp` package. Module presence is not proof that OpenPGP symbols are linked or called. Symbol-level reachability remains unverified; the selected OTLP/OIDC/transform pipeline does not configure OpenPGP.

The scan's binary package inventory confirms `confighttp`, `configgrpc` and `configtls` **1.71.0**, exporterhelper **0.165.0**, OIDC extension **0.165.0**, Mongo driver **2.9.2** and Prometheus **0.315.1**. Consequently:

- The recent [zstd window allocation advisory](https://github.com/open-telemetry/opentelemetry-collector/security/advisories/GHSA-vf52-ppm4-c35w) is fixed in the embedded HTTP/gRPC modules at 1.71.0. A decoded body-size setting alone would not have fixed an older decoder's early allocation.
- The [cross-tenant queue-partition collision](https://github.com/open-telemetry/opentelemetry-collector/security/advisories/GHSA-cx3c-rmcx-ff35) was fixed in exporterhelper 0.164.0; this image has 0.165.0 and our selected exporter queue/batching are disabled.
- The [OIDC symlink key-rotation issue](https://github.com/open-telemetry/opentelemetry-collector-contrib/security/advisories/GHSA-xpvr-wrwx-rm99) affects <0.160.0 and is outside this pin. The [TLS CA-file recreation issue](https://github.com/open-telemetry/opentelemetry-collector/security/advisories/GHSA-xcv6-86p2-hfq3) is also fixed in the embedded module.

### PostgreSQL 17.12 Alpine / planned RDS

[PostgreSQL's November 12 release](https://www.postgresql.org/about/news/postgresql-187-1712-1616-1520-1425-and-19-rc-2-released-3442/) identifies **17.12** as the patched 17.x release. This includes fixes relevant to SQL privileges and row security. Existing installations may also require the documented post-update data/index/backup actions. The intended managed RDS engine must be verified against the patched versions actually available in the selected region.

The container's [62 raw matches](postgres-image-findings.json) all occur in **`/usr/local/bin/gosu`**, whose build metadata identifies **gosu 1.19.0 / Go 1.24.6**; its scanned Alpine package result is empty. They are not 62 PostgreSQL-server vulnerabilities. The critical match, CVE-2025-68121, concerns Go TLS session resumption, while gosu is a privilege-switching/exec utility. Its [maintainer policy](https://github.com/tianon/gosu/blob/master/SECURITY.md) specifically warns that unused Go interfaces produce misleading scanner results and asks for `govulncheck` validation. That symbol-level check was **not** run here; the helper matches remain unverified rather than blanket-dismissed. Do not rebuild the database around raw counts without validating applicability.

### Node runtime, lab images and ElasticMQ

[Node's November security release](https://nodejs.org/en/blog/vulnerability/november-2026-security-releases) supplies **26.13.1** and **24.22.3**. Production's selected 26.13.1 includes those fixes. **24.19.0**, currently used for compatibility CI and the historical sink, predates them; raise the maintained 24.x floor/pins and rerun checks. The root engine range currently also permits older patch levels and should be tightened during remediation.

The full Bookworm images are test/build environments with hundreds of OS/development packages. Their raw inventories are retained as [Node 26 lab findings](stack-node26-image-findings.json.gz) and [Node 24 sink findings](sink-node24-image-findings.json.gz). They also contain flagged global npm dependencies, including Undici; the clean project runtime npm audit does not cover those tools. These images are **not** suitable as unreviewed production images. Use a maintained minimal runtime stage with production-only dependencies and repeat the image scan; separately maintain the builder. Do not impose a zero-raw-count gate that ignores vendor applicability and unused code.

[ElasticMQ matches](elasticmq-image-findings.json) are Alpine library matches. Its two critical rows are the same **CVE-2026-31789** on libcrypto/libssl: the [upstream advisory](https://github.com/advisories/GHSA-j79m-9jxq-788r) requires **32-bit** size arithmetic, whereas this image is **arm64**, so that architecture condition is absent. The other matches remain separate findings requiring package refresh/triage; Graal/native-image Java dependency coverage is incomplete. ElasticMQ remains isolated test infrastructure, never the production broker.

## Planned managed services and remaining security obligations

SQS Standard, ECS/Fargate and RDS are selected services, not local lockfile packages. No live Stellarcope resources exist to certify. AWS's [CVE-2026-98432 bulletin](https://aws.amazon.com/security/security-bulletins/2026-160-aws/) says newly launched Fargate tasks after November 1 use a patched platform; existing tasks need retirement/replacement according to maintenance settings. Select maintained platform/engine revisions and keep that lifecycle in deployment/runbooks.

The current selected runtime npm graph, including Fastify 5.12.8, TypeBox 1.4.7, JOSE 6.2.17, pg 8.23.1, Stellar SDK 17.4.0, AWS SQS SDK 3.1169.0 and the OTel JS packages, has no npm advisory matches at query time. [Fastify's recent timeout advisory](https://github.com/fastify/fastify/security/advisories/GHSA-3qgw-9275-xf8w) is fixed at the selected **5.12.8**. None of these facts establishes correct authorization, TLS, tenant isolation, network access or deletion handling in our future application. Those remain required implementation/test boundaries already in the rollout plan.

## Remediation order before production approval

1. Move the actual application off the old SDK/TOML chain, refresh maintained Node 24 pins/engine floors, and update vulnerable tooling. Verify real signing/seal behavior, brand output, strict peers, type checks, lint, migrations and the full suite. Re-audit; do not force automatic major changes/downgrades.
2. Build the production application with a maintained minimal runtime stage, production-only packages and no unnecessary package managers/compiler tools. Record immutable digests and scan that artifact rather than approving the existing full test image.
3. For Umami, obtain a refreshed upstream image or tested narrow rebuild, then rerun schema/resolver/transaction/reporting/startup contracts. For Collector, obtain a patched Go build or document validated reachability for each remaining match. Do not silently replace either pinned artifact and inherit the old experiment results.
4. Keep PostgreSQL 17 patched on the actual provider; validate gosu findings by symbol-aware analysis if the local image becomes a release artifact. Refresh/isolate the emulator as test tooling.
5. Repeat dated registry/image checks at the release boundary. For each remaining match, record the package path, version, platform, reachable input and an evidence-backed disposition with a revisit condition. No broad ignore list or permanent all-clear.

## Reproduction and limits

```sh
npm audit --json
npm audit --omit=dev --json
npm audit --prefix experiments/stack --json
npm audit --prefix experiments/stack --omit=dev --json
trivy image --scanners vuln --image-src docker --format json IMAGE
```

Use the selected supported Node runtime. A nonzero npm-audit exit is expected when findings exist. Refresh Trivy's database before rescanning; do not assume today's results persist. The saved image inventories omit long descriptions and repeat references, but retain every detected match and package path. Repetitive lab inventories are losslessly gzip-compressed. Full raw reports remain temporary local artifacts, with SHA-256 hashes recorded in the status file.

Coverage limitations: no production image/deployment exists yet; no symbol-aware Go analysis, Graal binary dependency recovery, exploit proof, full source-code security audit, secret scan or AWS account review was performed. This review establishes known advisory matches and version/configuration applicability where evidence supports it. Findings remain open until remediated or individually validated.
