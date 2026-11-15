# Local reliability experiment

Runs real Umami 3.5.0, OTel Collector Contrib 0.165.0, PostgreSQL 17.12, and a real OpenTelemetry JS SDK 3.0 histogram exporter. It does not modify Albireo's application or connect to production. See [findings](FINDINGS.md) and the [architecture proposal](../../engineering/2026-11-15-architecture.md).

Run from the repository root after installing its existing dependencies:

```sh
node experiments/reliability/run.mjs
```

The database-outage case includes a 15-second hold before killing the collector. Set `OUTAGE_HOLD_MS` (0–60000) to change it.

Docker must be running. Host ports 33029, 55429, 43229, 43129–43131 and 13129–13131 must be free. Run only one lab at a time because those host ports are fixed. The harness builds small fixture images (no host bind mounts). Each run uses a unique Compose project; cleanup removes only that project's containers and volumes. Logs, resolved sink dependency lockfile, exact generated configurations, image identities, fixture hashes, and machine-readable results remain under `results/<timestamp>/`.

The sink is a deliberately small **test-only** OTLP/HTTP JSON receiver. In the same database transaction it writes both an append-only table and a table deduplicated by canonical metric stream/point identity. It rejects conflicting contents for the same point. It also contains a disposable OIDC issuer and isolated web/counter pattern fixtures. None of these is a production endpoint or an implemented Umami patch. Only loopback host ports are exposed; all credentials and events are synthetic.

Scenarios:

- Baseline Umami event and OTel metric delivery.
- Identical Umami requests repeated.
- Umami commits, a proxy discards the response, then the caller retries.
- Database stopped: direct Umami request versus persisted OTel acceptance.
- Collector killed with SIGKILL and restarted using its existing persistent volume.
- Same crash with an in-memory queue, followed by a healthy delivery marker.
- Metrics sink commits, disconnects before acknowledgement, and receives a retry.
- Actual Collector OIDC verification, forged tenant attribution, and two-tenant persistence/replay.
- Attribute allowlisting before persistence, and metrics-only endpoint behavior.
- Real OTel JavaScript SDK 3.0 exporting three delta histogram observations through the authenticated Collector.
- Attribute ordering independent metric deduplication and changed-content rejection.
- Actual Albireo histogram overflow defect reproduction (a negative control, not a fix).
- Exporter queue batching versus an in-memory batch processor across SIGKILL.
- Tiny queue exhaustion and visible 503 responses, downstream permanent errors, retry expiration, and queue-volume loss.
- Actual cumulative-to-delta processor losing its baseline on restart.
- Atomic web receipt/effect fixture: lost response, concurrent retries, changed payload, two tenants, and rollback.
- Durable integer counter checkpoint fixture: writer restart, concurrent retry, multiple instances, new epochs, and invalid ordering/reset rejection.
- Real PostgreSQL RLS with a non-owner role, failed cross-tenant write, and transaction context reset/reuse.

The baseline persistent configuration has no in-memory batch processor before its queue. `configs.mjs` generates the comparison configurations under ignored `generated/`; they are copied into the Collector fixture image. Each generated config is also saved with that run's evidence. The probe container is recreated sequentially for independent cases, with logs saved before each replacement.

File storage uses `fsync: true`, one queue consumer, and unlimited retry elapsed time except in the intentional three-second expiration case. These are controlled experiment settings, not a production sizing or retention policy. The volume-loss case removes only `<this unique project>_probe` after its disposable container has been removed. It leaves all other projects/volumes alone.

"Passed" means the assertions matched the expected behavior, including expected data loss or current application defects. It does not mean every tested configuration is safe to deploy.

Limits: this is not a load test, managed database failover, physical disk-full/corruption test, multi-zone test, complete privacy strategy, or proof of a four-nines SLO. It does not implement production Umami idempotency, full cumulative histogram checkpointing, credential revocation/rotation, or all tenant SDK/OTLP encodings. Those are explicitly listed production acceptance gates in the proposal, rather than inferred from this local experiment.

## Security maintenance

Active fixtures use the shared [maintained service images](../../infra/images/README.md), patched Node 24.22.3 and a frozen sink dependency graph. Earlier result snapshots describe their original artifacts; rerun the experiments after changing images.
