import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfig } from './config.ts'

await test('configuration defaults are bounded and bind both listeners to loopback', () => {
  assert.deepEqual(loadConfig({}), {
    publicHost: '127.0.0.1',
    publicPort: 8080,
    privateHost: '127.0.0.1',
    privatePort: 8081,
    publicBodyLimit: 8192,
    privateBodyLimit: 4194304,
    logLevel: 'info',
  })
})

await test('configuration accepts explicit IP bindings and smaller body limits without mutating env', () => {
  const env = {
    INGRESS_PUBLIC_HOST: '0.0.0.0',
    INGRESS_PRIVATE_HOST: '::1',
    INGRESS_PUBLIC_PORT: '3000',
    INGRESS_PRIVATE_PORT: '65535',
    INGRESS_PUBLIC_BODY_LIMIT_BYTES: '1024',
    INGRESS_PRIVATE_BODY_LIMIT_BYTES: '4096',
    INGRESS_LOG_LEVEL: 'silent',
    DATABASE_URL: 'not-read-by-this-service',
  }
  const before = { ...env }
  assert.deepEqual(loadConfig(env), {
    publicHost: '0.0.0.0',
    publicPort: 3000,
    privateHost: '::1',
    privatePort: 65535,
    publicBodyLimit: 1024,
    privateBodyLimit: 4096,
    logLevel: 'silent',
  })
  assert.deepEqual(env, before)
})

await test('configuration rejects malformed, empty and out-of-range ports', () => {
  for (const key of ['INGRESS_PUBLIC_PORT', 'INGRESS_PRIVATE_PORT']) {
    for (const value of [
      '',
      '0',
      '-1',
      '65536',
      '1.5',
      '1e3',
      '+8080',
      '08080',
      ' 8080',
      'Infinity',
      'NaN',
    ]) {
      assert.throws(() => loadConfig({ [key]: value }), new RegExp(key), `${key}=${value}`)
    }
  }
})

await test('configuration rejects port collisions even on different hosts', () => {
  assert.throws(
    () => loadConfig({ INGRESS_PRIVATE_PORT: '8080', INGRESS_PRIVATE_HOST: '::1' }),
    /INGRESS_PRIVATE_PORT/,
  )
})

await test('configuration requires literal IP hosts', () => {
  for (const key of ['INGRESS_PUBLIC_HOST', 'INGRESS_PRIVATE_HOST']) {
    for (const value of ['', 'localhost', 'example.invalid', '127.0.0.1:8080', '[::1]']) {
      assert.throws(() => loadConfig({ [key]: value }), new RegExp(key))
    }
  }
})

await test('configuration only permits reducing the request limits', () => {
  for (const [key, max] of [
    ['INGRESS_PUBLIC_BODY_LIMIT_BYTES', 8192],
    ['INGRESS_PRIVATE_BODY_LIMIT_BYTES', 4194304],
  ] as const) {
    for (const value of ['', '0', '-1', '0.5', '1e3', String(max + 1), '9007199254740993']) {
      assert.throws(() => loadConfig({ [key]: value }), new RegExp(key))
    }
  }
})

await test('configuration accepts only supported log levels', () => {
  for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']) {
    assert.equal(loadConfig({ INGRESS_LOG_LEVEL: level }).logLevel, level)
  }
  for (const level of ['', 'verbose', 'INFO', ' info']) {
    assert.throws(() => loadConfig({ INGRESS_LOG_LEVEL: level }), /INGRESS_LOG_LEVEL/)
  }
})

await test('configuration errors identify keys without exposing invalid values', () => {
  assert.throws(
    () => loadConfig({ INGRESS_PUBLIC_PORT: 'synthetic-secret-value' }),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /INGRESS_PUBLIC_PORT/)
      assert.doesNotMatch(error.message, /synthetic-secret-value/)
      return true
    },
  )
})
