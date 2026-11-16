// Bounded failure experiments, not application implementations.
import assert from 'node:assert/strict'
import { writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { emptyHistogram, observe, quantile } from '../../packages/core/histogram.ts'

export async function extended(ctx) {
  const { compose, exec, project, pool, sql, request, until, pause, record, metricBody, metricRows, collectorReady, artifacts } = ctx
  const endpoint = 'http://127.0.0.1:43131/v1/metrics'
  const sink = 'http://127.0.0.1:43229'
  const control = (body) => request(`${sink}/control`, body)
  const health = async () => (await request(`${sink}/health`)).body
  let config = 'auth'
  let logNumber = 0
  const saveProbe = async () => writeFile(`${artifacts}/probe-${++logNumber}-${config}.log`, await compose('logs', '--no-color', 'probe'))
  async function probe(name) {
    await saveProbe()
    config = name
    process.env.LAB_CONFIG = `${name}.yaml`
    await compose('up', '-d', '--force-recreate', 'probe')
    await collectorReady(13131)
  }
  async function crash() {
    await compose('kill', '-s', 'SIGKILL', 'probe')
    await compose('up', '-d', 'probe')
    await collectorReady(13131)
  }
  const send = (scenario, headers = {}) => request(endpoint, metricBody(scenario), headers)
  const delivered = (scenario, n) => until(`${scenario}: ${n} unique points`, async () => (await metricRows(scenario)).dedup.rows === n)

  try {
    await probe('auth')
    // Real OIDC verification and real transform processor, followed by durable replay.
    const token = async (tenant, audience) => (await request(`${sink}/token`, { tenant, audience })).body.token
    const a = { authorization: `Bearer ${await token('tenant-a')}` }
    const b = { authorization: `Bearer ${await token('tenant-b')}` }
    const missing = await send('auth_missing')
    const bad = await send('auth_wrong_audience', { authorization: `Bearer ${await token('tenant-a', 'wrong')}` })
    assert.equal(missing.status, 401)
    assert.equal(bad.status, 401)
    await control({ sinkStatus: 503 })
    const forged = metricBody('tenant_replay')
    forged.resourceMetrics[0].resource.attributes.push({ key: 'tenant.id', value: { stringValue: 'forged-tenant' } })
    forged.resourceMetrics[0].resource.attributes.push({ key: 'private.email', value: { stringValue: 'synthetic@example.invalid' } })
    forged.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram.dataPoints[0].attributes.push({ key: 'url.full', value: { stringValue: 'https://example.invalid/?secret=synthetic' } })
    assert.equal((await request(endpoint, forged, a)).status, 200)
    assert.equal((await request(endpoint, forged, b)).status, 200)
    await until('tenant points reached unavailable sink', async () => (await health()).attempts.tenant_replay >= 1)
    await crash()
    await control({ sinkStatus: 200 })
    await delivered('tenant_replay', 2)
    const tenants = await sql("select tenant, observations::int from lab_metric_dedup where scenario='tenant_replay' order by tenant")
    assert.deepEqual(tenants, [{ tenant: 'tenant-a', observations: 1 }, { tenant: 'tenant-b', observations: 1 }])
    record('authenticated_tenant_binding_survives_replay', { missingStatus: missing.status, wrongAudienceStatus: bad.status, persisted: tenants, forgedTenantRows: 0 })
    const persisted = await sql("select point from lab_metric_raw where scenario='tenant_replay'")
    assert.ok(persisted.every((r) => !JSON.stringify(r.point).includes('synthetic')))
    assert.ok(persisted.every((r) => !JSON.stringify(r.point).includes('forged-tenant')))
    record('attribute_allowlist_before_persistent_queue', { persistedEnvelopes: persisted.length, removedResourceEmailAndRawUrl: true })
    const sdkResponse = await request(`${sink}/sdk`, { token: a.authorization.slice(7) })
    assert.equal(sdkResponse.status, 200, JSON.stringify(sdkResponse))
    await delivered('real_sdk_delta', 1)
    assert.equal((await metricRows('real_sdk_delta')).dedup.observations, 3)
    record('real_js_sdk_3_delta_histogram', { ...sdkResponse.body, storedObservations: 3, tenant: (await sql("select tenant from lab_metric_dedup where scenario='real_sdk_delta'"))[0].tenant })
    for (const signal of ['traces', 'logs']) {
      const response = await request(`http://127.0.0.1:43131/v1/${signal}`, {}, a)
      assert.equal(response.status, 404)
    }
    record('metrics_only_receiver', { tracesStatus: 404, logsStatus: 404 })

    // Same identity with differently ordered attributes is a retry, not new data.
    const original = metricBody('canonical_retry')
    assert.equal((await request(`${sink}/v1/metrics`, original)).status, 200)
    const reordered = structuredClone(original)
    reordered.resourceMetrics[0].resource.attributes.reverse()
    reordered.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram.dataPoints[0].attributes.reverse()
    assert.equal((await request(`${sink}/v1/metrics`, reordered)).status, 200)
    assert.deepEqual(await metricRows('canonical_retry'), { raw: { rows: 2, observations: 2 }, dedup: { rows: 1, observations: 1 } })
    const conflict = structuredClone(original)
    conflict.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram.dataPoints[0].sum = 0.09
    assert.equal((await request(`${sink}/v1/metrics`, conflict)).status, 400)
    record('canonical_point_identity_and_conflict', { stored: await metricRows('canonical_retry'), changedContentsStatus: 400 })
    const misleading = quantile(observe(emptyHistogram(), 100_000), 0.95)
    assert.equal(misleading, 19_500)
    record('current_histogram_overflow_reproduction', { onlyObservationMs: 100_000, currentReportedP95Ms: misleading, correctInterpretation: 'p95 is above 10000ms; final bucket has no finite upper bound', isKnownApplicationDefect: true })

    // Kill only after acknowledged points are known to still be waiting for batching.
    for (const [name, scenario, expected] of [['queue-batch', 'queue_batch_crash', 3], ['processor-batch', 'processor_batch_crash', 0]]) {
      await probe(name)
      for (let i = 0; i < 3; i++) assert.equal((await send(scenario)).status, 200)
      assert.equal((await health()).attempts[scenario] ?? 0, 0, 'batch flushed before crash; test precondition invalid')
      await crash()
      const marker = metricBody(`${scenario}_marker`)
      const histogram = marker.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram
      histogram.dataPoints = Array.from({ length: 100 }, (_, i) => {
        const point = structuredClone(histogram.dataPoints[0])
        point.timeUnixNano = String(BigInt(point.timeUnixNano) + BigInt(i))
        return point
      })
      assert.equal((await request(endpoint, marker)).status, 200)
      await delivered(`${scenario}_marker`, 100)
      // New process delivered a full batch. Earlier in-memory points cannot be replayed.
      assert.equal((await metricRows(scenario)).dedup.rows, expected)
      record(`${name.replace('-', '_')}_sigkill`, { acceptedBeforeCrash: 3, retainedAfterCrash: expected, deliveredMarkerPoints: 100 })
    }

    await probe('tiny')
    await control({ sinkStatus: 503 })
    const responses = []
    for (let i = 0; i < 12; i++) responses.push(await send('queue_full'))
    const accepted = responses.filter((r) => r.status === 200).length
    const rejected = responses.filter((r) => r.status === 503).length
    assert.ok(accepted > 0 && rejected > 0)
    assert.equal(accepted + rejected, 12, JSON.stringify(responses))
    await control({ sinkStatus: 200 })
    await delivered('queue_full', accepted)
    record('queue_exhaustion_is_visible', { attempted: 12, accepted, rejected503: rejected, persisted: (await metricRows('queue_full')).dedup.rows })

    await probe('plain')
    await control({ sinkStatus: 400 })
    assert.equal((await send('permanent_rejection')).status, 200)
    await until('permanent error dropped', async () => /Dropping data|dropping data/.test(await compose('logs', '--no-color', 'probe')))
    await control({ sinkStatus: 200 })
    assert.equal((await send('permanent_recovery_marker')).status, 200)
    await delivered('permanent_recovery_marker', 1)
    assert.equal((await metricRows('permanent_rejection')).dedup.rows, 0)
    record('downstream_permanent_error_drops_accepted_data', { accepted: 1, downstreamStatus: 400, stored: 0, attempts: (await health()).attempts.permanent_rejection })

    await probe('finite')
    await control({ sinkStatus: 503 })
    assert.equal((await send('retry_expired')).status, 200)
    await until('retry limit dropped data', async () => /Dropping data|dropping data/.test(await compose('logs', '--no-color', 'probe')))
    await control({ sinkStatus: 200 })
    assert.equal((await send('retry_expired_marker')).status, 200)
    await delivered('retry_expired_marker', 1)
    assert.equal((await metricRows('retry_expired')).dedup.rows, 0)
    record('finite_retry_limit_drops_accepted_data', { accepted: 1, retryLimit: '3s', stored: 0, attempts: (await health()).attempts.retry_expired })

    await probe('plain')
    await control({ sinkStatus: 503 })
    assert.equal((await send('volume_loss')).status, 200)
    await until('volume loss point enqueued and attempted', async () => (await health()).attempts.volume_loss >= 1)
    await saveProbe()
    await compose('kill', '-s', 'SIGKILL', 'probe')
    await compose('rm', '-f', 'probe')
    // Only the dedicated volume belonging to THIS disposable project is removed.
    assert.match(project, /^stellarcope-lab-\d+$/)
    await exec('docker', ['volume', 'rm', `${project}_probe`])
    await compose('up', '-d', 'probe')
    await collectorReady(13131)
    await control({ sinkStatus: 200 })
    assert.equal((await send('volume_loss_marker')).status, 200)
    await delivered('volume_loss_marker', 1)
    assert.equal((await metricRows('volume_loss')).dedup.rows, 0)
    record('persistent_volume_loss', { accepted: 1, storedAfterFreshVolume: 0, recoveryMarker: 1 })

    // A durable queue does not make cumulative-to-delta PROCESSOR state durable.
    await probe('cumulative')
    const cumulative = metricBody('cumulative_restart')
    const hist = cumulative.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram
    hist.aggregationTemporality = 2
    const point = hist.dataPoints[0]
    const start = BigInt(point.startTimeUnixNano)
    for (const [step, count] of [[1, 100], [2, 150], [3, 200]]) {
      if (step === 3) await crash()
      Object.assign(point, { timeUnixNano: String(start + BigInt(step) * 1_000_000_000n), count: String(count), sum: count * 0.05, bucketCounts: [String(count), '0', '0'] })
      assert.equal((await request(endpoint, cumulative)).status, 200)
      await delivered('cumulative_restart', step)
    }
    const cumulativeResult = await metricRows('cumulative_restart')
    assert.equal(cumulativeResult.dedup.observations, 350)
    record('cumulative_processor_baseline_lost_on_restart', { trueCumulativeTotal: 200, storedAfterKeepPolicyRestart: cumulativeResult.dedup.observations })

    // Proof of atomic web receipt + side effects, with concurrent retry and rollback.
    await sql('create table lab_web_receipts (tenant text, event_id text, payload_hash text, primary key(tenant,event_id))')
    await sql('create table lab_web_effects (tenant text, event_id text, payload jsonb, primary key(tenant,event_id))')
    const web = { tenant: 'a', eventId: randomUUID(), payload: { page: '/hello', props: { action: 'test' } } }
    await control({ loseNextWebResponse: true })
    assert.equal((await request(`${sink}/web-idempotent`, web)).status, null)
    const retries = await Promise.all(Array.from({ length: 8 }, () => request(`${sink}/web-idempotent`, web)))
    assert.ok(retries.every((r) => r.status === 200))
    assert.equal((await request(`${sink}/web-idempotent`, { ...web, payload: { page: '/changed' } })).status, 409)
    assert.equal((await request(`${sink}/web-idempotent`, { ...web, tenant: 'b' })).status, 200)
    const rollback = { ...web, eventId: randomUUID(), failBeforeCommit: true }
    assert.equal((await request(`${sink}/web-idempotent`, rollback)).status, 503)
    assert.equal((await sql('select * from lab_web_receipts where event_id=$1', [rollback.eventId])).length, 0)
    assert.equal((await sql('select * from lab_web_effects where event_id=$1', [rollback.eventId])).length, 0)
    assert.equal((await request(`${sink}/web-idempotent`, { ...rollback, failBeforeCommit: false })).status, 200)
    const effects = await sql('select tenant, count(*)::int count from lab_web_effects where event_id=$1 group by tenant order by tenant', [web.eventId])
    assert.deepEqual(effects, [{ tenant: 'a', count: 1 }, { tenant: 'b', count: 1 }])
    record('atomic_web_pattern_fixture', { concurrentRetries: 8, changedPayloadStatus: 409, effectsPerTenant: effects, failedTransactionLeftReceiptAndEffects: false })

    // Durable integer-counter checkpoint; explicit initial-zero policy for this fixture.
    await sql('create table lab_counter_state (tenant text, instance text, epoch text, ending bigint, value bigint, total bigint, primary key(tenant,instance,epoch))')
    await sql('create table lab_counter_receipts (tenant text, instance text, epoch text, ending bigint, value bigint, primary key(tenant,instance,epoch,ending))')
    const counter = { tenant: 'a', instance: 'one', epoch: 'boot-1' }
    for (const [end, value] of [[1, 100], [2, 150]]) assert.equal((await request(`${sink}/counter`, { ...counter, end, value })).status, 200)
    await compose('restart', 'sink')
    await until('sink restarted', async () => (await request(`${sink}/health`)).status === 200)
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => request(`${sink}/counter`, { ...counter, end: 3, value: 200 })))
    assert.ok(concurrent.every((r) => r.status === 200))
    assert.equal((await request(`${sink}/counter`, { ...counter, end: 2, value: 150 })).status, 200)
    assert.equal((await request(`${sink}/counter`, { ...counter, end: 3, value: 201 })).status, 409)
    assert.equal((await request(`${sink}/counter`, { ...counter, end: 0, value: 50 })).status, 422)
    assert.equal((await request(`${sink}/counter`, { ...counter, end: 4, value: 10 })).status, 422)
    assert.equal((await request(`${sink}/counter`, { ...counter, epoch: 'boot-2', end: 4, value: 10 })).status, 200)
    assert.equal((await request(`${sink}/counter`, { ...counter, instance: 'two', end: 3, value: 40 })).status, 200)
    const totals = await sql('select instance,epoch,total::int from lab_counter_state order by instance,epoch')
    assert.deepEqual(totals, [{ instance: 'one', epoch: 'boot-1', total: 200 }, { instance: 'one', epoch: 'boot-2', total: 10 }, { instance: 'two', epoch: 'boot-1', total: 40 }])
    record('durable_counter_checkpoint_fixture', { totals, writerRestarted: true, concurrentRetries: 8, conflictStatus: 409, outOfOrderAndInvalidResetStatus: 422 })

    // Real PostgreSQL RLS with a non-owner role and a reused pooled connection.
    await sql("create role lab_runtime nologin; create table lab_rls (tenant text, value text); insert into lab_rls values ('a','private-a'),('b','private-b'); alter table lab_rls enable row level security; alter table lab_rls force row level security; create policy tenant_policy on lab_rls using (tenant=current_setting('lab.tenant',true)) with check (tenant=current_setting('lab.tenant',true)); grant select,insert on lab_rls to lab_runtime")
    const connection = await pool.connect()
    try {
      await connection.query('set role lab_runtime')
      await connection.query('begin')
      await connection.query("select set_config('lab.tenant','a',true)")
      assert.deepEqual((await connection.query('select * from lab_rls')).rows, [{ tenant: 'a', value: 'private-a' }])
      await assert.rejects(connection.query("insert into lab_rls values ('b','cross-tenant')"), { code: '42501' })
      await connection.query('rollback')
      assert.equal((await connection.query('select * from lab_rls')).rowCount, 0)
      await connection.query('begin')
      await connection.query("select set_config('lab.tenant','b',true)")
      assert.deepEqual((await connection.query('select * from lab_rls')).rows, [{ tenant: 'b', value: 'private-b' }])
      await connection.query('commit')
      record('postgres_rls_and_transaction_context', { aSees: ['a'], bSees: ['b'], crossTenantWriteSqlState: '42501', visibleWithoutContextAfterRollback: 0 })
    } finally { await connection.query('rollback'); await connection.query('reset role'); connection.release() }
  } finally {
    await saveProbe().catch(() => {})
    await control({ sinkStatus: 200 }).catch(() => {})
  }
}
