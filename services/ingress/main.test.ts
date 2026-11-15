import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer, connect, type Server } from 'node:net'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { Writable } from 'node:stream'
import { startIngress } from './main.ts'
import { loadConfig } from './config.ts'

function port(server: Server): number {
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  return address.port
}
async function listen(server: Server, requestedPort = 0) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(requestedPort, '127.0.0.1', resolve)
  })
  return port(server)
}
async function close(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  )
}
const config = () => ({
  ...loadConfig({ INGRESS_LOG_LEVEL: 'silent' }),
  publicPort: 0,
  privatePort: 0,
})

await test('real listeners isolate routes, enforce limits and close idempotently', async (t) => {
  const service = await startIngress({ ...config(), publicBodyLimit: 256 })
  t.after(() => service.close())
  const publicUrl = `http://127.0.0.1:${port(service.publicApp.server)}`
  const privateUrl = `http://127.0.0.1:${port(service.privateApp.server)}`
  assert.notEqual(publicUrl, privateUrl)
  assert.equal((await fetch(publicUrl + '/health/live')).status, 200)
  assert.equal((await fetch(privateUrl + '/health/live')).status, 200)
  assert.equal((await fetch(publicUrl + '/health/ready')).status, 503)
  const request = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'private.invalid',
      'x-forwarded-host': privateUrl,
    },
    body: '{}',
  }
  assert.equal((await fetch(publicUrl + '/internal/v1/metrics', request)).status, 404)
  assert.equal((await fetch(privateUrl + '/internal/v1/metrics', request)).status, 503)
  assert.equal(
    (
      await fetch(publicUrl + '/v1/events', {
        ...request,
        body: JSON.stringify({ secret: 'x'.repeat(300) }),
      })
    ).status,
    413,
  )
  await Promise.all([service.close(), service.close()])
  assert.equal(service.publicApp.server.listening, false)
  assert.equal(service.privateApp.server.listening, false)
})

await test('a second listener bind failure releases the first socket', async (t) => {
  const occupied = createServer()
  const publicPort = await listen(occupied)
  t.after(() => close(occupied))
  const reservation = createServer()
  const privatePort = await listen(reservation)
  await close(reservation)
  await assert.rejects(startIngress({ ...config(), publicPort, privatePort }), {
    code: 'EADDRINUSE',
  })
  const probe = createServer()
  await listen(probe, privatePort)
  await close(probe)
})

await test('malformed HTTP transport errors do not log raw packets at trace level', async (t) => {
  let logs = ''
  const loggerStream = new Writable({
    write(chunk: Buffer, _encoding, done) {
      logs += chunk.toString()
      done()
    },
  })
  const service = await startIngress({ ...config(), logLevel: 'trace' }, { loggerStream })
  t.after(() => service.close())
  await new Promise<void>((resolve, reject) => {
    const socket = connect(port(service.publicApp.server), '127.0.0.1', () => {
      socket.end(
        'GET /?token=synthetic-transport-secret HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer synthetic-transport-secret\r\nBad\x00Header: x\r\n\r\n',
      )
    })
    socket.on('data', () => {})
    socket.once('error', reject)
    socket.once('close', () => resolve())
  })
  assert.doesNotMatch(logs, /synthetic-transport-secret|rawPacket|Authorization/)
})

function child(env: NodeJS.ProcessEnv) {
  const inherited = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith('INGRESS_')),
  )
  const subprocess = spawn(
    globalThis.process.execPath,
    [fileURLToPath(new URL('./main.ts', import.meta.url))],
    { env: { ...inherited, ...env }, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stdout = ''
  let stderr = ''
  const started = new Promise<void>((resolve, reject) => {
    subprocess.stdout.on('data', (data: Buffer) => {
      stdout += data.toString()
      if (stdout.includes('Ingress listeners started')) resolve()
    })
    subprocess.once('error', reject)
    subprocess.once('exit', () => {
      if (!stdout.includes('Ingress listeners started'))
        reject(new Error('Child exited before startup'))
    })
  })
  // Invalid-startup tests consume exit, not the startup promise.
  started.catch(() => {})
  subprocess.stderr.on('data', (data: Buffer) => {
    stderr += data.toString()
  })
  const exited = new Promise<number | null>((resolve, reject) => {
    subprocess.once('exit', resolve)
    subprocess.once('error', reject)
  })
  return { process: subprocess, started, exited, output: () => stdout + stderr }
}

await test(
  'CLI invalid configuration names the key without reflecting its value',
  { timeout: 10000 },
  async (t) => {
    const app = child({ INGRESS_PUBLIC_PORT: 'synthetic-config-secret' })
    t.after(() => {
      app.process.kill('SIGKILL')
    })
    assert.equal(await app.exited, 1)
    assert.match(app.output(), /Ingress startup failed/)
    assert.match(app.output(), /INGRESS_PUBLIC_PORT/)
    assert.doesNotMatch(app.output(), /synthetic-config-secret/)
  },
)

await test(
  'CLI SIGTERM drains both listeners and exits successfully',
  { timeout: 10000 },
  async (t) => {
    const first = createServer(),
      second = createServer()
    const publicPort = await listen(first),
      privatePort = await listen(second)
    await close(first)
    await close(second)
    const app = child({
      INGRESS_PUBLIC_PORT: String(publicPort),
      INGRESS_PRIVATE_PORT: String(privatePort),
    })
    t.after(() => {
      app.process.kill('SIGKILL')
    })
    await app.started
    assert.equal((await fetch(`http://127.0.0.1:${publicPort}/health/live`)).status, 200)
    assert.equal((await fetch(`http://127.0.0.1:${privatePort}/health/live`)).status, 200)
    app.process.kill('SIGTERM')
    assert.equal(await app.exited, 0)
    await assert.rejects(fetch(`http://127.0.0.1:${publicPort}/health/live`))
    await assert.rejects(fetch(`http://127.0.0.1:${privatePort}/health/live`))
  },
)

await test('CLI bind failures remain generic', { timeout: 10000 }, async (t) => {
  const occupied = createServer()
  const publicPort = await listen(occupied)
  t.after(() => close(occupied))
  const reservation = createServer()
  const privatePort = await listen(reservation)
  await close(reservation)
  const app = child({
    INGRESS_PUBLIC_PORT: String(publicPort),
    INGRESS_PRIVATE_PORT: String(privatePort),
  })
  t.after(() => {
    app.process.kill('SIGKILL')
  })
  assert.equal(await app.exited, 1)
  assert.match(app.output(), /Ingress startup failed/)
  assert.doesNotMatch(app.output(), /EADDRINUSE|Error:|node:internal/)
})
