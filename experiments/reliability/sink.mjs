// Test-only OTLP/HTTP JSON sink and response-loss proxy. Not production ingestion code.
import { createServer } from 'node:http'
import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import pg from 'pg'

let loseNextMetricsResponse = false
let loseNextWebResponse = false
let sinkStatus = 200
const attempts = {}
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'lab', alg: 'RS256', use: 'sig' }
const issuer = 'http://sink:4320/issuer'
const canonical = (value) => {
  if (Array.isArray(value)) {
    const entries = value.every((v) => v && typeof v === 'object' && typeof v.key === 'string')
      ? [...value].sort((a, b) => a.key.localeCompare(b.key)) : value
    return entries.map(canonical)
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]))
  return value
}
const hash = (v) => createHash('sha256').update(JSON.stringify(canonical(v))).digest('hex')
const counts = { received: 0, committed: 0, failures: 0, lostResponses: 0, webLostResponses: 0 }
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 1000 })
pool.on('error', (err) => console.log(JSON.stringify({ event: 'pool_error', code: err.code })))
const read = async (req) => {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  return Buffer.concat(chunks).toString()
}
const json = (res, status, value) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(value))
}

createServer(async (req, res) => {
  try {
    if (req.url === '/health') return json(res, 200, { ...counts, attempts })
    if (req.url === '/issuer/.well-known/openid-configuration') return json(res, 200, { issuer, jwks_uri: `${issuer}/keys`, id_token_signing_alg_values_supported: ['RS256'] })
    if (req.url === '/issuer/keys') return json(res, 200, { keys: [jwk] })
    if (req.url === '/token') {
      // Test issuer only: no real identities or production credentials.
      const { tenant, audience = 'albireo-lab' } = JSON.parse(await read(req))
      const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
      const input = `${enc({ alg: 'RS256', kid: 'lab', typ: 'JWT' })}.${enc({ iss: issuer, aud: audience, sub: tenant, tenant_id: tenant, exp: Math.floor(Date.now() / 1000) + 3600 })}`
      return json(res, 200, { token: `${input}.${sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}` })
    }
    if (req.url === '/control') {
      const body = JSON.parse(await read(req))
      if ('loseNextMetricsResponse' in body) loseNextMetricsResponse = body.loseNextMetricsResponse === true
      if ('loseNextWebResponse' in body) loseNextWebResponse = body.loseNextWebResponse === true
      if ('sinkStatus' in body) sinkStatus = body.sinkStatus
      return json(res, 200, counts)
    }
    if (req.url === '/sdk') {
      const { token } = JSON.parse(await read(req))
      const { MeterProvider, PeriodicExportingMetricReader, AggregationTemporality } = await import('@opentelemetry/sdk-metrics')
      const { OTLPMetricExporter } = await import('@opentelemetry/exporter-metrics-otlp-http')
      const { resourceFromAttributes } = await import('@opentelemetry/resources')
      const exporter = new OTLPMetricExporter({ url: 'http://probe:4318/v1/metrics', headers: { authorization: `Bearer ${token}` }, temporalityPreference: AggregationTemporality.DELTA })
      const provider = new MeterProvider({
        resource: resourceFromAttributes({ 'service.name': 'sdk-lab', 'service.instance.id': 'sdk-1' }),
        readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 })],
      })
      try {
        const histogram = provider.getMeter('sdk-3-fixture').createHistogram('http.server.request.duration', { unit: 's' })
        for (const value of [0.05, 0.1, 0.2]) histogram.record(value, { 'http.route': '/sdk', 'http.response.status_code': 200, 'lab.case': 'real_sdk_delta' })
        await provider.forceFlush()
      } finally { await provider.shutdown() }
      return json(res, 200, { sdkMetrics: '3.0.0', exporter: '0.300.0', recorded: 3 })
    }
    if (req.url === '/web-idempotent') {
      // Pattern proof in fixture tables, NOT a patch to Umami's /api/send.
      const { tenant, eventId, payload, failBeforeCommit } = JSON.parse(await read(req))
      const digest = hash(payload)
      const client = await pool.connect()
      try {
        await client.query('begin')
        const inserted = await client.query('insert into lab_web_receipts values ($1,$2,$3) on conflict do nothing returning event_id', [tenant, eventId, digest])
        if (inserted.rowCount) {
          await client.query('insert into lab_web_effects values ($1,$2,$3)', [tenant, eventId, payload])
          if (failBeforeCommit) throw new Error('injected rollback before commit')
        } else {
          const prior = await client.query('select payload_hash from lab_web_receipts where tenant=$1 and event_id=$2', [tenant, eventId])
          if (prior.rows[0].payload_hash !== digest) {
            await client.query('rollback')
            return json(res, 409, { error: 'same event ID with different payload' })
          }
        }
        await client.query('commit')
      } catch (err) {
        await client.query('rollback').catch(() => {})
        throw err
      } finally { client.release() }
      if (loseNextWebResponse) { loseNextWebResponse = false; return res.destroy() }
      return json(res, 200, {})
    }
    if (req.url === '/counter') {
      // Deliberately bounded cumulative integer-counter prototype; not a histogram adapter.
      const { tenant, instance, epoch, end, value } = JSON.parse(await read(req))
      const client = await pool.connect()
      try {
        await client.query('begin')
        await client.query('insert into lab_counter_state values ($1,$2,$3,0,0,0) on conflict do nothing', [tenant, instance, epoch])
        const state = (await client.query('select * from lab_counter_state where tenant=$1 and instance=$2 and epoch=$3 for update', [tenant, instance, epoch])).rows[0]
        const prior = (await client.query('select value from lab_counter_receipts where tenant=$1 and instance=$2 and epoch=$3 and ending=$4', [tenant, instance, epoch, end])).rows[0]
        if (prior) {
          if (Number(prior.value) !== value) { await client.query('rollback'); return json(res, 409, {}) }
        } else {
          if (end <= Number(state.ending) || value < Number(state.value)) { await client.query('rollback'); return json(res, 422, { error: 'out-of-order or invalid reset' }) }
          await client.query('insert into lab_counter_receipts values ($1,$2,$3,$4,$5)', [tenant, instance, epoch, end, value])
          await client.query('update lab_counter_state set total=total+$4-value, value=$4, ending=$5 where tenant=$1 and instance=$2 and epoch=$3', [tenant, instance, epoch, value, end])
        }
        await client.query('commit')
        return json(res, 200, {})
      } catch (err) { await client.query('rollback').catch(() => {}); throw err }
      finally { client.release() }
    }
    if (req.url === '/web-proxy') {
      const body = await read(req)
      const upstream = await fetch('http://umami:3000/api/send', {
        method: 'POST', body, headers: {
          'content-type': 'application/json',
          'user-agent': req.headers['user-agent'],
          'x-forwarded-for': '203.0.113.42',
          'cf-ipcountry': 'TR',
          ...(req.headers['x-umami-cache'] ? { 'x-umami-cache': req.headers['x-umami-cache'] } : {}),
        },
      })
      await upstream.text()
      if (upstream.status !== 200) return json(res, 502, { upstream: upstream.status })
      counts.webLostResponses++
      console.log(JSON.stringify({ event: 'web_commit_then_disconnect', status: upstream.status }))
      // Destroy only after Umami has acknowledged its write. The client cannot know it committed.
      res.destroy()
      return
    }
    if (req.url !== '/v1/metrics') return json(res, 404, {})
    const payload = JSON.parse(await read(req))
    counts.received++
    for (const r of payload.resourceMetrics ?? []) for (const s of r.scopeMetrics ?? []) for (const m of s.metrics ?? []) {
      for (const p of (m.histogram ?? m.sum)?.dataPoints ?? []) {
        const name = p.attributes?.find((a) => a.key === 'lab.case')?.value?.stringValue
        attempts[name] = (attempts[name] ?? 0) + 1
      }
    }
    if (sinkStatus !== 200) return json(res, sinkStatus, { message: 'injected downstream rejection' })
    const client = await pool.connect()
    try {
      await client.query('begin')
      for (const resource of payload.resourceMetrics ?? []) {
        for (const scope of resource.scopeMetrics ?? []) {
          for (const metric of scope.metrics ?? []) {
            for (const point of (metric.histogram ?? metric.sum)?.dataPoints ?? []) {
              const scenario = point.attributes?.find((a) => a.key === 'lab.case')?.value?.stringValue
              const tenant = resource.resource?.attributes?.find((a) => a.key === 'tenant.id')?.value?.stringValue ?? null
              const key = hash({
                resource: resource.resource, resourceSchema: resource.schemaUrl,
                scope: scope.scope, scopeSchema: scope.schemaUrl,
                metric: metric.name, unit: metric.unit, type: metric.histogram ? 'histogram' : 'sum',
                temporality: (metric.histogram ?? metric.sum).aggregationTemporality, attributes: point.attributes,
                start: point.startTimeUnixNano, end: point.timeUnixNano,
              })
              const digest = hash(point)
              const observations = point.count ?? point.asInt
              await client.query('insert into lab_metric_raw values ($1,$2,$3,$4,$5)', [key, scenario, observations, tenant, { resource: resource.resource, point }])
              const inserted = await client.query('insert into lab_metric_dedup values ($1,$2,$3,$4,$5) on conflict do nothing returning identity', [key, scenario, observations, digest, tenant])
              if (!inserted.rowCount) {
                const prior = (await client.query('select payload_hash from lab_metric_dedup where identity=$1', [key])).rows[0]
                if (prior.payload_hash !== digest) {
                  await client.query('rollback')
                  return json(res, 400, { message: 'same point identity with different contents' })
                }
              }
            }
          }
        }
      }
      await client.query('commit')
      counts.committed++
    } catch (err) {
      await client.query('rollback').catch(() => {})
      throw err
    } finally {
      client.release()
    }
    if (loseNextMetricsResponse) {
      loseNextMetricsResponse = false
      counts.lostResponses++
      console.log(JSON.stringify({ event: 'metrics_commit_then_disconnect' }))
      res.destroy()
      return
    }
    json(res, 200, {})
  } catch (err) {
    counts.failures++
    console.log(JSON.stringify({ event: 'sink_error', code: err.code, message: err.message }))
    if (!res.headersSent && !res.destroyed) json(res, 503, { error: 'test database unavailable' })
  }
}).listen(4320, '0.0.0.0', () => console.log('lab sink listening'))
