# Maintained service images

These definitions patch the dependencies identified in the dated service review.
They preserve the selected APIs and database schema. The pinned upstream Umami,
PostgreSQL and emulator digests are the Linux/arm64 artifacts used by the local
experiments. Select matching upstream digests and repeat the contracts before
using another architecture.

| Image | Maintenance boundary |
|---|---|
| Umami 3.5.0 | Retain the upstream artifact and ownership; replace Node with patched 22.23.5, update Alpine packages and fast-uri to 3.1.9, and remove global package managers. Keep local Prisma and the original startup/migration script. |
| Collector 0.165.0 | Build the required official components with OCB, Go 1.27.4 and x/crypto 0.59.0. The scratch runtime contains only the binary, CA certificates and selected configuration. |
| PostgreSQL 17.12 | Retain the database image; rebuild gosu from upstream 1.20's immutable revision using Go 1.27.4 and x/sys 0.44.0. |
| ElasticMQ 1.7.1 | Retain the test emulator binary; upgrade its linked Alpine libraries. It is not the production broker. |

The Collector manifest includes batch/cumulative conversion and file storage for
the failure experiments. The selected stack configuration still disables local
queueing/retries and admits data synchronously through the relay. No custom
Collector component implementation is introduced.

Build through either experiment's Compose file; both use these same definitions:

```sh
docker compose -f experiments/stack/compose.yaml build
```

The original Collector wrapper Dockerfiles require a base built with:

```sh
docker build --platform linux/arm64 --target base \
  -f infra/images/collector.Dockerfile \
  -t albireo-collector:0.165.0-security1 .
```

Run the complete stack and reliability experiments as documented in their
directories, sequentially. The stack harness builds browser assets explicitly
and checks real migrations, the Umami transaction/reporting contract, OIDC,
duplicates, compressed input and queue/database/restart failures. The reliability
harness independently checks the original retry and persistence behavior.

Node test images now use patched Alpine bases and invoke Node directly after
removing global package-manager bundles. Dev dependencies remain in the stack
lab because its purpose includes compiler/lint/migration tests. The reliability
sink has a dedicated frozen dependency graph. These are test images, not a
production ingress service or a cloud deployment.

Keep the scoped npm overrides for estree's minimatch and node-pg-migrate's glob
until compatible upstream releases remove the affected dependency edges. Validate
typed lint/negative controls and real migration/no-op behavior when changing them.
CI audits the application and both active experiment graphs in addition to the
normal checks.

Base images are digest-pinned. Alpine security-package upgrades resolve the
maintained repository at build time; record the resulting image identity and
rescan the built artifact. Archive old audit results as historical evidence.
Remove a local overlay only after a maintained upstream artifact passes the same
security and compatibility checks. No scanner ignore list is used.
