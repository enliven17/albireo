import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { Writable } from 'node:stream'
import { gzipSync } from 'node:zlib'
import { createIngressApps, ErrorResponseSchema } from './app.ts'
import { loadConfig, type IngressConfig } from './config.ts'

const page = {
  version: 1,
  siteId: 'albireo',
  eventId: '9d94ec7c-b593-4632-9880-19d87b7a2875',
  type: 'pageview',
  path: '/swap',
}
function setup(t: TestContext, overrides: Partial<IngressConfig> = {}, loggerStream?: Writable) {
  const apps = createIngressApps(
    { ...loadConfig({ INGRESS_LOG_LEVEL: 'silent' }), ...overrides },
    loggerStream ? { loggerStream } : {},
  )
  t.after(async () => {
    await Promise.all([apps.publicApp.close(), apps.privateApp.close()])
  })
  return apps
}

await test('both listeners are live without dependencies, and neither claims readiness', async (t) => {
  const apps = setup(t)
  for (const app of [apps.publicApp, apps.privateApp]) {
    const live = await app.inject('/health/live')
    assert.equal(live.statusCode, 200)
    assert.deepEqual(live.json(), { status: 'ok' })
    const ready = await app.inject('/health/ready')
    assert.equal(ready.statusCode, 503)
    assert.deepEqual(ready.json(), { status: 'not_ready' })
  }
})

await test('admission placeholders reject valid requests without issuing receipts', async (t) => {
  const { publicApp, privateApp } = setup(t)
  for (const [app, url, payload] of [
    [publicApp, '/v1/events', page],
    [privateApp, '/internal/v1/metrics', {}],
  ] as const) {
    const response = await app.inject({ method: 'POST', url, payload })
    assert.equal(response.statusCode, 503)
    assert.deepEqual(response.json(), { code: 'INGESTION_NOT_CONFIGURED' })
    assert.equal(response.headers['retry-after'], '60')
  }
})

await test('private routes cannot be reached through the public listener or forwarded host headers', async (t) => {
  const { publicApp, privateApp } = setup(t)
  for (const url of ['/internal/v1/metrics', '/%69nternal/v1/metrics', '//internal/v1/metrics']) {
    const result = await publicApp.inject({
      method: 'POST',
      url,
      payload: {},
      headers: {
        host: 'private.invalid:8081',
        'x-forwarded-host': '127.0.0.1:8081',
        forwarded: 'host=127.0.0.1:8081',
      },
    })
    assert.equal(result.statusCode, 404)
    assert.deepEqual(result.json(), { code: 'NOT_FOUND' })
  }
  assert.equal(
    (await privateApp.inject({ method: 'POST', url: '/v1/events', payload: page })).statusCode,
    404,
  )
  for (const app of [publicApp, privateApp]) {
    for (const url of ['/e', '/token', '/consume', '/fail-next'])
      assert.equal((await app.inject(url)).statusCode, 404)
  }
})

await test('web validation rejects client authority and coercion instead of silently stripping fields', async (t) => {
  const { publicApp } = setup(t)
  for (const payload of [
    { ...page, tenantId: 'other' },
    { ...page, walletAddress: 'GSECRET' },
    { ...page, version: '1' },
    { ...page, path: '/a?secret=x' },
    { ...page, path: '/a\u0085' },
  ]) {
    const result = await publicApp.inject({ method: 'POST', url: '/v1/events', payload })
    assert.equal(result.statusCode, 400)
    assert.deepEqual(result.json(), { code: 'INVALID_REQUEST' })
  }
})

await test('both listeners enforce byte limits, including multibyte JSON', async (t) => {
  const { publicApp, privateApp } = setup(t, { publicBodyLimit: 256, privateBodyLimit: 256 })
  const payload = JSON.stringify({ ...page, path: '/' + 'é'.repeat(100) })
  assert.ok(payload.length < 256 && Buffer.byteLength(payload) > 256)
  for (const [app, url] of [
    [publicApp, '/v1/events'],
    [privateApp, '/internal/v1/metrics'],
  ] as const) {
    const result = await app.inject({
      method: 'POST',
      url,
      headers: { 'content-type': 'application/json' },
      payload,
    })
    assert.equal(result.statusCode, 413)
    assert.deepEqual(result.json(), { code: 'PAYLOAD_TOO_LARGE' })
  }
})

await test('compressed bodies and non-JSON media are rejected before admission', async (t) => {
  const { publicApp, privateApp } = setup(t)
  for (const [app, url] of [
    [publicApp, '/v1/events'],
    [privateApp, '/internal/v1/metrics'],
  ] as const) {
    for (const encoding of ['gzip', 'br', 'zstd']) {
      assert.equal(
        (
          await app.inject({
            method: 'POST',
            url,
            headers: { 'content-type': 'application/json', 'content-encoding': encoding },
            payload: gzipSync('{}'),
          })
        ).statusCode,
        415,
      )
    }
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url,
          headers: { 'content-type': 'text/plain' },
          payload: '{}',
        })
      ).statusCode,
      415,
    )
  }
})

await test('malformed and prototype-poisoning JSON produces generic errors', async (t) => {
  const { publicApp, privateApp } = setup(t)
  for (const [app, url] of [
    [publicApp, '/v1/events'],
    [privateApp, '/internal/v1/metrics'],
  ] as const) {
    for (const payload of ['{"synthetic-secret":', '{"__proto__":{"polluted":true}}']) {
      const result = await app.inject({
        method: 'POST',
        url,
        headers: { 'content-type': 'application/json' },
        payload,
      })
      assert.equal(result.statusCode, 400)
      assert.deepEqual(result.json(), { code: 'INVALID_REQUEST' })
    }
  }
})

await test('error responses and logs do not reflect request data or exception details', async (t) => {
  let logs = ''
  const stream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      logs += chunk.toString()
      done()
    },
  })
  const { publicApp } = setup(t, { logLevel: 'trace' }, stream)
  const marker = 'synthetic-sensitive-marker'
  publicApp.get('/boom', () => {
    throw new Error(marker)
  })
  publicApp.log.info('safe-log-control')
  for (const url of ['/boom', `/missing?token=${marker}`, `/bad%ZZ?token=${marker}`]) {
    const result = await publicApp.inject({
      url,
      headers: {
        authorization: `Bearer ${marker}`,
        cookie: marker,
        'user-agent': marker,
        'x-request-id': marker,
        'x-forwarded-for': '203.0.113.123',
      },
    })
    assert.ok([400, 404, 500].includes(result.statusCode))
    assert.doesNotMatch(result.body, new RegExp(marker))
    assert.deepEqual(Object.keys(result.json<Record<string, unknown>>()), ['code'])
  }
  await publicApp.inject({
    method: 'POST',
    url: '/v1/events',
    payload: { ...page, path: '/' + marker },
  })
  assert.match(logs, /safe-log-control/)
  assert.doesNotMatch(logs, /synthetic-sensitive-marker|203\.0\.113\.123|rawPacket/)
})

await test('public response serialization projects only the declared error DTO', async (t) => {
  const { publicApp } = setup(t)
  publicApp.get(
    '/projection',
    { schema: { response: { 200: ErrorResponseSchema } } },
    (_request, reply) => {
      const unprojected = { code: 'SAFE', secret: 'must-not-escape' }
      reply.send(unprojected)
    },
  )
  assert.deepEqual((await publicApp.inject('/projection')).json(), { code: 'SAFE' })
})
