import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { generateKeyPair, SignJWT } from 'jose'
import SwaggerParser from '@apidevtools/swagger-parser'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { makeApp } from './app.ts'
import { admit } from './practices.ts'

const keys = await generateKeyPair('RS256')
const sign = (claims: Record<string, unknown> = { tenant_id: 'tenant-a' }, expires = '10m') =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer('albireo-lab')
    .setAudience('ingest')
    .setIssuedAt()
    .setExpirationTime(expires)
    .sign(keys.privateKey)
const body = () => ({ eventId: randomUUID(), path: '/test', name: 'pageview' })

test('schema inference, runtime validation, beacon content type, and response redaction', async () => {
  const seen: unknown[] = []
  const app = await makeApp(keys.publicKey, async (event) => {
    seen.push(event)
  })
  try {
    const headers = { authorization: `Bearer ${await sign()}` }
    const valid = body()
    const response = await app.inject({ method: 'POST', url: '/e', headers, payload: valid })
    assert.equal(response.statusCode, 202)
    assert.deepEqual(response.json(), { accepted: true, eventId: valid.eventId })
    assert.deepEqual(seen, [{ tenant: 'tenant-a', event: valid }])
    const beacon = await app.inject({
      method: 'POST',
      url: '/e',
      headers: { ...headers, 'content-type': 'text/plain;charset=UTF-8' },
      payload: JSON.stringify(body()),
    })
    assert.equal(beacon.statusCode, 202)
    for (const invalid of [
      { ...body(), eventId: 'not-a-uuid' },
      { ...body(), path: '/test?secret=yes' },
      { ...body(), tenant: 'tenant-b' },
      { ...body(), name: 42 },
      { ...body(), path: '/test#secret' },
    ])
      assert.equal(
        (await app.inject({ method: 'POST', url: '/e', headers, payload: invalid })).statusCode,
        400,
      )
    assert.equal(seen.length, 2)
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/e',
          headers: { ...headers, 'content-type': 'text/plain' },
          payload: '{',
        })
      ).statusCode,
      400,
    )
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/e',
          headers: { ...headers, 'content-type': 'application/xml' },
          payload: '<data/>',
        })
      ).statusCode,
      415,
    )
    assert.equal(
      (
        await app.inject({
          method: 'POST',
          url: '/e',
          headers,
          payload: { ...body(), name: 'x'.repeat(40_000) },
        })
      ).statusCode,
      413,
    )
    const spec = app.swagger()
    await mkdir(new URL('../results/', import.meta.url), { recursive: true })
    const specPath = new URL('../results/openapi-typebox.json', import.meta.url)
    await writeFile(specPath, JSON.stringify(spec))
    const validated = await SwaggerParser.validate(fileURLToPath(specPath))
    assert.equal('openapi' in validated ? validated.openapi : '', '3.0.3')
  } finally {
    await app.close()
  }
})

test('required signed claims, expiration, tenant binding and forged headers', async () => {
  const seen: unknown[] = []
  const app = await makeApp(keys.publicKey, async (event) => {
    seen.push(event)
  })
  try {
    const send = (token?: string, extra = {}) =>
      app.inject({
        method: 'POST',
        url: '/e',
        headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...extra },
        payload: body(),
      })
    assert.equal((await send()).statusCode, 401)
    assert.equal((await send(await sign({ tenant_id: 'tenant-a' }, '-1m'))).statusCode, 401)
    assert.equal((await send(await sign({}))).statusCode, 401)
    assert.equal((await send(await sign({ tenant_id: '' }))).statusCode, 403)
    assert.equal((await send(await sign({ tenant_id: 'unknown' }))).statusCode, 403)
    assert.equal((await send(await sign(), { 'x-tenant-id': 'tenant-b' })).statusCode, 202)
    assert.equal((await send(await sign({ tenant_id: 'tenant-b' }))).statusCode, 202)
    assert.deepEqual(
      seen.map((v) => (v as { tenant: string }).tenant),
      ['tenant-a', 'tenant-b'],
    )
  } finally {
    await app.close()
  }
})

test('response waits for durable publisher result; failure is retryable', async () => {
  let release: (() => void) | undefined
  let completed = false
  const app = await makeApp(keys.publicKey, async () => {
    await new Promise<void>((resolve) => {
      release = resolve
    })
  })
  try {
    const pending = app
      .inject({
        method: 'POST',
        url: '/e',
        headers: { authorization: `Bearer ${await sign()}` },
        payload: body(),
      })
      .then((response) => {
        completed = true
        return response
      })
    while (!release) await new Promise((resolve) => setTimeout(resolve, 1))
    assert.equal(completed, false)
    release()
    assert.equal((await pending).statusCode, 202)
  } finally {
    await app.close()
  }
  const failed = await makeApp(keys.publicKey, async () => {
    throw new Error('broker unavailable')
  })
  try {
    assert.equal(
      (
        await failed.inject({
          method: 'POST',
          url: '/e',
          headers: { authorization: `Bearer ${await sign()}` },
          payload: body(),
        })
      ).statusCode,
      503,
    )
  } finally {
    await failed.close()
  }
})

test('deadline cancellation reaches a cooperative publisher', async () => {
  // Active timer keeps the process alive while AbortSignal.timeout's timer is unref'd.
  const keepAlive = setTimeout(() => {}, 1000)
  try {
    await assert.rejects(
      admit(
        async (signal) =>
          await new Promise<void>((_resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => {
                reject(signal.reason)
              },
              { once: true },
            )
          }),
        10,
      ),
      { name: 'TimeoutError' },
    )
  } finally {
    clearTimeout(keepAlive)
  }
})
