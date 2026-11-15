import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import pg from '../../node_modules/pg/lib/index.js'
import { extended } from './extended.mjs'
import { configs } from './configs.mjs'

const exec = promisify(execFile)
const directory = fileURLToPath(new URL('./', import.meta.url))
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const project = `albireo-lab-${Date.now()}`
const artifacts = `${directory}results/${stamp}`
const outageHoldMs = Number(process.env.OUTAGE_HOLD_MS ?? 15_000)
assert.ok(Number.isFinite(outageHoldMs) && outageHoldMs >= 0 && outageHoldMs <= 60_000)
const report = { startedAt: new Date().toISOString(), project, outageHoldMs, versions: {}, tests: [], limitations: [
  'Disposable local PostgreSQL; no managed database failover or availability-zone loss is simulated.',
  'OTel sink is test-only OTLP/HTTP JSON ingestion, not a completed Albireo OTLP implementation.',
  'Local queue-volume removal models lost storage, not a replicated storage or availability-zone failover.',
  'Atomic web/counter fixtures prove database patterns; they are not an implemented Umami patch or a complete OTLP backend.',
  'Finite retry/restart experiments do not establish an availability SLO.',
] }
const compose = async (...args) => {
  const result = await exec('docker', ['compose', '-p', project, '-f', `${directory}compose.yaml`, ...args], { maxBuffer: 8 * 1024 * 1024 })
  return result.stdout + result.stderr
}
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function until(label, fn, timeout = 60_000) {
  const start = Date.now()
  let last
  while (Date.now() - start < timeout) {
    try { if (await fn()) return Date.now() - start } catch (err) { last = err }
    await pause(250)
  }
  throw new Error(`Timed out: ${label}${last ? ` (${last.message})` : ''}`)
}
async function request(url, body, headers = {}, timeout = 10_000) {
  const start = performance.now()
  try {
    const res = await fetch(url, { method: body === undefined ? 'GET' : 'POST',
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...headers }, signal: AbortSignal.timeout(timeout) })
    const text = await res.text()
    let parsed = text || null
    try { parsed = text ? JSON.parse(text) : null } catch { /* Plain HTTP errors are not transport failures. */ }
    return { status: res.status, body: parsed, elapsedMs: Math.round(performance.now() - start) }
  } catch (err) {
    return { status: null, error: err.cause?.code ?? err.name, elapsedMs: Math.round(performance.now() - start) }
  }
}
const pool = new pg.Pool({ connectionString: 'postgresql://lab:disposable-lab-password@127.0.0.1:55429/umami', max: 2, connectionTimeoutMillis: 1000 })
pool.on('error', () => {})
const sql = async (query, args = []) => (await pool.query(query, args)).rows
const metricRows = async (scenario) => {
  const [raw] = await sql('select count(*)::int rows, coalesce(sum(observations),0)::int observations from lab_metric_raw where scenario=$1', [scenario])
  const [dedup] = await sql('select count(*)::int rows, coalesce(sum(observations),0)::int observations from lab_metric_dedup where scenario=$1', [scenario])
  return { raw, dedup }
}
const record = (name, value) => { report.tests.push({ name, ...value }); console.log(JSON.stringify({ test: name, ...value })) }
const webHeaders = { 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', 'x-forwarded-for': '203.0.113.42', 'cf-ipcountry': 'TR' }
const website = randomUUID()
const webBody = (name) => ({ type: 'event', payload: { website, hostname: 'lab.example', url: '/reliability', screen: '1440x900', language: 'en-US', name } })
const webCount = async (name) => (await sql('select count(*)::int count, count(distinct event_id)::int ids from website_event where website_id=$1 and event_name=$2', [website, name]))[0]
let pointSequence = 0
function metricBody(scenario) {
  const start = BigInt(Date.now()) * 1_000_000n + BigInt(++pointSequence) * 1000n
  return { resourceMetrics: [{ resource: { attributes: [{ key: 'service.name', value: { stringValue: 'local-lab' } }, { key: 'service.instance.id', value: { stringValue: 'fixture-1' } }] },
    scopeMetrics: [{ scope: { name: 'albireo-reliability-lab' }, metrics: [{ name: 'http.server.request.duration', unit: 's', histogram: { aggregationTemporality: 1, dataPoints: [{
      attributes: [{ key: 'http.route', value: { stringValue: '/test' } }, { key: 'http.response.status_code', value: { intValue: '200' } }, { key: 'lab.case', value: { stringValue: scenario } }],
      startTimeUnixNano: String(start), timeUnixNano: String(start + 50_000_000n), count: '1', sum: 0.05, explicitBounds: [0.1, 1], bucketCounts: ['1', '0', '0'],
    }] } }] }] }] }
}
const sendMetrics = async (port, scenario, count) => {
  const responses = []
  for (let i = 0; i < count; i++) responses.push(await request(`http://127.0.0.1:${port}/v1/metrics`, metricBody(scenario)))
  assert.ok(responses.every((r) => r.status === 200), JSON.stringify(responses))
  return responses.map(({ status, elapsedMs }) => ({ status, elapsedMs }))
}
const dbReady = () => until('PostgreSQL ready', async () => (await sql('select 1')).length === 1)
const collectorReady = (port) => until('Collector ready', async () => (await request(`http://127.0.0.1:${port}/`)).status === 200)

await mkdir(artifacts, { recursive: true })
await writeFile(`${artifacts}/configs.json`, JSON.stringify(await configs(directory), null, 2))
try {
  report.repositoryCommit = (await exec('git', ['rev-parse', 'HEAD'], { cwd: directory })).stdout.trim()
  report.fixtureHashes = {}
  for (const name of ['run.mjs', 'extended.mjs', 'configs.mjs', 'sink.mjs', 'compose.yaml', 'persistent.yaml', 'memory.yaml', 'Dockerfile.collector', 'Dockerfile.sink']) {
    report.fixtureHashes[name] = createHash('sha256').update(await readFile(`${directory}${name}`)).digest('hex')
  }
  console.log(`Starting isolated project ${project}`)
  await writeFile(`${artifacts}/build.log`, await compose('build'))
  await writeFile(`${artifacts}/startup.log`, await compose('up', '-d', 'db', 'umami', 'sink', 'persistent', 'memory'))
  console.log('Fixture images built and local services started.')
  await writeFile(`${artifacts}/sink-package-lock.json`, await compose('exec', '-T', 'sink', 'cat', '/lab/package-lock.json'))
  for (const serviceImage of ['albireo-reliability-sink:local', 'albireo-reliability-collector:0.165.0-security1']) {
    report.versions[serviceImage] = (await exec('docker', ['image', 'inspect', serviceImage, '--format', '{{.Id}}'])).stdout.trim()
  }
  await dbReady()
  await until('Umami migrated and serving', async () => {
    const response = await request('http://127.0.0.1:33029/api/heartbeat')
    if (response.status !== 200) return false
    return (await sql("select 1 from information_schema.tables where table_name='website_event'")).length === 1
  }, 120_000)
  await until('sink ready', async () => (await request('http://127.0.0.1:43229/health')).status === 200)
  await collectorReady(13129)
  await collectorReady(13130)
  for (const image of ['albireo-umami:3.5.0-security1', 'albireo-reliability-collector:0.165.0-security1', 'albireo-postgres:17.12-security1', 'albireo-reliability-sink:local']) {
    const { stdout } = await exec('docker', ['image', 'inspect', image, '--format', '{{json .RepoDigests}}'])
    report.versions[image] = JSON.parse(stdout)
  }
  report.versions.database = (await sql('select version()'))[0].version
  report.versions.hostNode = process.version
  await sql('insert into website (website_id,name,domain) values ($1,$2,$3)', [website, 'Disposable reliability lab', 'lab.example'])
  await sql('create table lab_metric_raw (identity text not null, scenario text not null, observations bigint not null, tenant text, point jsonb not null)')
  await sql('create table lab_metric_dedup (identity text primary key, scenario text not null, observations bigint not null, payload_hash text not null, tenant text)')

  const baseline = await request('http://127.0.0.1:33029/api/send', webBody('baseline'), webHeaders)
  assert.equal(baseline.status, 200, JSON.stringify(baseline))
  assert.ok(baseline.body.cache, JSON.stringify(baseline))
  assert.equal((await webCount('baseline')).count, 1)
  const headers = { ...webHeaders, 'x-umami-cache': baseline.body.cache }
  record('umami_baseline', { httpStatus: baseline.status, stored: await webCount('baseline') })

  const repeated = webBody('identical_retry')
  const repeatResponses = [await request('http://127.0.0.1:33029/api/send', repeated, headers), await request('http://127.0.0.1:33029/api/send', repeated, headers)]
  assert.ok(repeatResponses.every((r) => r.status === 200))
  assert.equal((await webCount('identical_retry')).count, 2)
  record('umami_identical_request_twice', { requests: 2, stored: await webCount('identical_retry') })

  const uncertain = webBody('lost_response_retry')
  const lost = await request('http://127.0.0.1:43229/web-proxy', uncertain, headers)
  assert.equal(lost.status, null, JSON.stringify(lost))
  assert.equal((await webCount('lost_response_retry')).count, 1)
  const retried = await request('http://127.0.0.1:33029/api/send', uncertain, headers)
  assert.equal(retried.status, 200)
  assert.equal((await webCount('lost_response_retry')).count, 2)
  record('umami_committed_but_response_lost', { initialClientResult: lost, retryStatus: retried.status, storedAfterRetry: await webCount('lost_response_retry') })

  await sendMetrics(43129, 'baseline', 1)
  await until('baseline metric committed', async () => (await metricRows('baseline')).raw.rows === 1)
  record('otel_baseline', { stored: await metricRows('baseline') })

  await compose('stop', '-t', '2', 'db')
  const outageStart = Date.now()
  const webOutage = await request('http://127.0.0.1:33029/api/send', webBody('db_outage_no_retry'), headers, 20_000)
  assert.equal(webOutage.status, 500, JSON.stringify(webOutage))
  const persistentAccepted = await sendMetrics(43129, 'persistent_restart', 10)
  await until('sink attempted export during DB outage', async () => (await request('http://127.0.0.1:43229/health')).body.failures > 0)
  console.log(`Holding the test database offline for an additional ${outageHoldMs} ms.`)
  await pause(outageHoldMs)
  const persistentCrashStart = Date.now()
  await compose('kill', '-s', 'SIGKILL', 'persistent')
  const duringRestart = await request('http://127.0.0.1:43129/v1/metrics', metricBody('receiver_unavailable'), {}, 1500)
  assert.equal(duringRestart.status, null, JSON.stringify(duringRestart))
  await compose('up', '-d', 'persistent')
  await collectorReady(13129)
  const receiverRestartMs = Date.now() - persistentCrashStart
  const afterRestartAccepted = await sendMetrics(43129, 'persistent_after_restart', 5)
  await compose('start', 'db')
  const databaseRestartMs = await dbReady()
  const drainMs = await until('persistent backlog drained', async () => (await metricRows('persistent_restart')).dedup.rows === 10 && (await metricRows('persistent_after_restart')).dedup.rows === 5)
  assert.equal((await webCount('db_outage_no_retry')).count, 0)
  record('database_outage_and_persistent_collector_sigkill', {
    webResponse: webOutage, webStoredWithoutRetry: await webCount('db_outage_no_retry'),
    acceptedBeforeCrash: persistentAccepted, acceptedAfterRestart: afterRestartAccepted,
    receiverDuringRestart: duringRestart, receiverRestartMs, databaseRestartMs, drainMs,
    outageThroughDrainMs: Date.now() - outageStart, beforeCrashStored: await metricRows('persistent_restart'), afterRestartStored: await metricRows('persistent_after_restart'),
  })
  const webRetryAfterRecovery = await request('http://127.0.0.1:33029/api/send', webBody('db_outage_no_retry'), headers)
  assert.equal(webRetryAfterRecovery.status, 200, JSON.stringify(webRetryAfterRecovery))
  assert.equal((await webCount('db_outage_no_retry')).count, 1)
  record('umami_explicit_retry_after_database_recovery', { httpStatus: webRetryAfterRecovery.status, stored: await webCount('db_outage_no_retry') })

  await compose('stop', '-t', '2', 'db')
  const failuresBefore = (await request('http://127.0.0.1:43229/health')).body.failures
  const memoryAccepted = await sendMetrics(43130, 'memory_restart', 10)
  await until('memory collector attempted export during DB outage', async () => (await request('http://127.0.0.1:43229/health')).body.failures > failuresBefore)
  await compose('kill', '-s', 'SIGKILL', 'memory')
  await compose('up', '-d', 'memory')
  await collectorReady(13130)
  await compose('start', 'db')
  await dbReady()
  // A post-restart marker confirms the new collector can deliver; the old in-memory batch cannot replay.
  await sendMetrics(43130, 'memory_recovery_marker', 1)
  await until('memory recovery marker committed', async () => (await metricRows('memory_recovery_marker')).dedup.rows === 1)
  await pause(2500)
  assert.equal((await metricRows('memory_restart')).raw.rows, 0)
  record('memory_only_collector_sigkill', { accepted: memoryAccepted, storedAfterRecovery: await metricRows('memory_restart'), recoveryMarker: await metricRows('memory_recovery_marker') })

  await request('http://127.0.0.1:43229/control', { loseNextMetricsResponse: true })
  await sendMetrics(43129, 'export_ack_lost', 1)
  await until('exporter retries after committed response loss', async () => (await metricRows('export_ack_lost')).raw.rows >= 2)
  const duplicate = await metricRows('export_ack_lost')
  assert.equal(duplicate.dedup.rows, 1)
  record('otel_commit_then_response_lost', { sentPoints: 1, stored: duplicate, sink: (await request('http://127.0.0.1:43229/health')).body })
  await extended({ compose, exec, project, pool, sql, request, until, pause, record, metricBody, metricRows, collectorReady, artifacts })
  report.status = 'passed'
} catch (err) {
  report.status = 'failed'
  report.error = { message: err.message, stack: err.stack }
  console.error(err)
  process.exitCode = 1
} finally {
  await writeFile(`${artifacts}/containers.txt`, await compose('ps', '-a').catch(String))
  await writeFile(`${artifacts}/stack.log`, await compose('logs', '--no-color').catch(String))
  report.finishedAt = new Date().toISOString()
  await pool.end()
  report.cleanup = await compose('down', '-v', '--remove-orphans').then(() => 'removed only this run’s containers, network, and disposable volumes', (err) => `cleanup failed: ${err.message}`)
  await writeFile(`${artifacts}/results.json`, `${JSON.stringify(report, null, 2)}\n`)
  console.log(`Report: ${artifacts}/results.json`)
  console.log(`Result: ${report.status}`)
}
