import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, writeFile, readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import assert from 'node:assert/strict'
const exec = promisify(execFile)
const cwd = fileURLToPath(new URL('./', import.meta.url))
const project = `albireo-stack-${Date.now()}`
const artifacts = `${cwd}results/${new Date().toISOString().replace(/[:.]/g, '-')}`
const report = { startedAt: new Date().toISOString(), project, checks: [], images: {}, limitations: ['Local emulator does not prove AWS SQS persistence, availability, IAM, or regional failover.', 'Fixtures are not production integrations; real Umami transactional writer and cloud acceptance work remain.'] }
const run = async (command, args) => {
  try { const r = await exec(command, args, { cwd, maxBuffer: 12 * 1024 * 1024 }); return { code: 0, output: r.stdout + r.stderr } }
  catch (e) { return { code: e.code ?? 1, output: (e.stdout ?? '') + (e.stderr ?? '') } }
}
const compose = async (...args) => {
  const r = await run('docker', ['compose', '-p', project, '-f', `${cwd}compose.yaml`, ...args])
  assert.equal(r.code, 0, r.output)
  return r.output
}
const check = async (name, command, args, expected = 0) => {
  const start = performance.now()
  const result = await run(command, args)
  await writeFile(`${artifacts}/${name}.log`, result.output)
  assert.equal(result.code, expected, result.output)
  record(name, { expectedExit: expected, elapsedMs: Math.round(performance.now() - start) })
  return result.output
}
const record = (name, value) => { report.checks.push({ name, ...value }); console.log(JSON.stringify({ check: name, ...value })) }
const request = async (url, body, headers = {}) => {
  const response = await fetch(url, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...headers }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body), signal: AbortSignal.timeout(5000) })
  const raw = await response.text()
  let parsed = raw
  try { parsed = raw ? JSON.parse(raw) : null } catch {}
  return { status: response.status, body: parsed }
}
async function until(label, fn, timeout = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try { if (await fn()) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Timed out: ${label}`)
}
const relay = 'http://127.0.0.1:43329'
const collector = 'http://127.0.0.1:43429/v1/metrics'
let sequence = 0
const metric = () => ({ resourceMetrics: [{ resource: { attributes: [{ key: 'tenant.id', value: { stringValue: 'forged' } }, { key: 'service.name', value: { stringValue: 'decision-lab' } }] }, scopeMetrics: [{ scope: { name: 'decision-lab' }, metrics: [{ name: 'http.server.request.duration', unit: 's', histogram: { aggregationTemporality: 1, dataPoints: [{ attributes: [{ key: 'http.route', value: { stringValue: '/test' } }], startTimeUnixNano: String(1000 + ++sequence), timeUnixNano: String(2000 + sequence), count: '1', sum: 0.05, bucketCounts: ['1','0'], explicitBounds: [0.1] }] } }] }] }] })
async function consume(n) {
  const messages = []
  await until(`consume ${n}`, async () => {
    messages.push(...(await request(`${relay}/consume`, {})).body.messages)
    return messages.length >= n
  })
  assert.equal(messages.length, n)
  return messages
}
await mkdir(artifacts, { recursive: true })
try {
  report.repositoryCommit=(await run('git',['rev-parse','HEAD'])).output.trim()
  report.sourceHashes={}
  const sourceFiles=['run.mjs','browser.mjs','guardrails.mjs','prepare-snapshot.mjs','prepare-upstream.mjs','compose.yaml','synchronous.yaml','Dockerfile','Dockerfile.collector','Dockerfile.snapshot','package.json','package-lock.json','frontend.package-lock.json','tsconfig.json','eslint.config.mjs','.prettierrc.json','.dockerignore',...(await readdir(`${cwd}../../infra/images`)).map(name=>`../../infra/images/${name}`),...(await readdir(`${cwd}upstream`)).map(name=>`upstream/${name}`),...(await readdir(`${cwd}src`)).map(name=>`src/${name}`),...(await readdir(`${cwd}migrations`)).map(name=>`migrations/${name}`)]
  for(const file of sourceFiles)report.sourceHashes[file]=createHash('sha256').update(await readFile(`${cwd}${file}`)).digest('hex')
  report.packages=JSON.parse(await readFile(`${cwd}package.json`,'utf8'))
  report.snapshotLockHash=createHash('sha256').update(await readFile(`${cwd}snapshot/package-lock.json`)).digest('hex')
  await check('strict-typecheck', 'npm', ['run', 'check'])
  await check('typed-lint', 'npm', ['run', 'lint'])
  await check('formatting', 'npm', ['exec', '--', 'prettier', '--check', 'src'])
  await check('guardrail-negative-controls', process.execPath, ['guardrails.mjs'])
  await check('typescript7-typecheck', process.execPath, ['tooling7/node_modules/typescript/bin/tsc', '--project', 'tsconfig.json', '--noEmit'])
  await mkdir(`${cwd}tooling7-peer`, { recursive: true })
  const peer = await check('typescript7-peer-rejection', 'npm', ['install', '--prefix', 'tooling7-peer', '--package-lock-only', '--ignore-scripts', '--strict-peer-deps', '--no-audit', '--no-fund', 'typescript@7.0.2', 'typescript-eslint@8.72.2'], 1)
  assert.match(peer, /ERESOLVE/)
  await writeFile(`${artifacts}/build.log`, await compose('build'))
  await check('build-node24', 'docker', ['build', '--platform', 'linux/arm64', '-t', 'albireo-stack-lab:24', '--build-arg', 'NODE_IMAGE=node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5', '.'])
  await check('node24-unit-profile', 'docker', ['run', '--rm', 'albireo-stack-lab:24', 'node', '--test', 'src/*.test.ts'])
  await check('build-app-node26', 'docker', ['build', '--platform', 'linux/arm64', '-f', 'Dockerfile.snapshot', '-t', 'albireo-app-snapshot:26', '.'])
  await check('existing-app-tests-node26', 'docker', ['run', '--rm', 'albireo-app-snapshot:26', 'node', '--test', 'packages/**/*.test.ts', 'services/**/*.test.ts'])
  await check('build-browser-assets', 'npm', ['--prefix', 'snapshot', 'run', 'build'])
  await check('frontend-browser-smoke',process.execPath,['browser.mjs'])
  report.browser=JSON.parse(await readFile(`${cwd}results/browser/results.json`,'utf8'))
  for (const name of ['albireo-stack-lab:24', 'albireo-stack-lab:26', 'albireo-app-snapshot:26', 'albireo-postgres:17.12-security1', 'albireo-elasticmq:1.7.1-security1', 'albireo-umami:3.5.0-security1', 'albireo-stack-collector:0.165.0-security1']) {
    const r = await run('docker', ['image', 'inspect', name, '--format', '{{json .RepoDigests}} {{.Id}}'])
    report.images[name] = r.output.trim()
  }
  await compose('up', '-d', 'db', 'queue')
  await until('PostgreSQL ready', async () => { await compose('exec', '-T', 'db', 'pg_isready', '-U', 'stacklab', '-d', 'stacklab'); return true })
  await compose('up', '-d', 'umami')
  await until('real Umami migrated and ready', async () => (await request('http://127.0.0.1:33529/api/heartbeat')).status === 200, 90_000)
  await check('node26-api-identity-sql', 'docker', ['compose', '-p', project, '-f', `${cwd}compose.yaml`, 'run', '--rm', '--no-deps', 'lab', 'node', '--test', 'src/*.test.ts'])
  await compose('up', '-d', 'lab')
  await until('queue relay', async () => (await request(`${relay}/health`)).status === 200)
  await compose('up', '-d', 'collector')
  await until('collector listener', async () => (await request(collector, {})).status === 401)
  const token = async (body) => (await request(`${relay}/token`, body)).body.token
  const headers = { authorization: `Bearer ${await token({ tenant: 'tenant-a' })}` }
  assert.equal((await request(collector, metric(), headers)).status, 200)
  const [first] = await consume(1)
  const tenantOf = (body) => body.resourceMetrics[0].resource.attributes.find((a) => a.key === 'tenant.id')?.value.stringValue
  assert.equal(tenantOf(first), 'tenant-a')
  record('synchronous-collector-queue-admission', { status: 200, persistedTenant: tenantOf(first), collectorLocalQueue: false })
  const privacy=metric()
  privacy.resourceMetrics[0].scopeMetrics[0].scope.attributes=[{key:'private.email',value:{stringValue:'synthetic@example.invalid'}}]
  const privacyPoint=privacy.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram.dataPoints[0]
  privacyPoint.attributes.push({key:'url.full',value:{stringValue:'https://example.invalid/?secret=synthetic'}})
  privacyPoint.exemplars=[{timeUnixNano:'2001',asDouble:0.05,traceId:'00000000000000000000000000000001',spanId:'0000000000000001'}]
  assert.equal((await request(collector,privacy,headers)).status,200)
  const [privateMessage]=await consume(1)
  assert.ok(!JSON.stringify(privateMessage).includes('synthetic'))
  assert.ok(!JSON.stringify(privateMessage).includes('exemplars'))
  record('sanitized-before-independent-queue',{scopeAttributesRemoved:true,rawUrlRemoved:true,exemplarsRemoved:true})
  const missingTenant = await request(collector, metric(), { authorization: `Bearer ${await token({})}` })
  assert.equal(missingTenant.status, 400, JSON.stringify(missingTenant))
  assert.equal((await request(collector, metric(), { authorization: `Bearer ${await token({ tenant: 'tenant-a', audience: 'wrong' })}` })).status, 401)
  assert.equal((await request(collector, metric(), { authorization: `Bearer ${await token({ tenant: 'tenant-a', expires: '-1m' })}` })).status, 401)
  record('native-auth-and-missing-claim-fail-closed', { missingTenantStatus: 400, expiredStatus: 401, wrongAudienceStatus: 401, forgedTenantCannotSurviveMissingClaim: true })
  await compose('stop', '-t', '1', 'db')
  assert.equal((await request(collector, metric(), headers)).status, 200)
  await compose('kill', '-s', 'SIGKILL', 'collector')
  await compose('up', '-d', 'collector')
  await until('collector restarted', async () => (await request(collector, {})).status === 401)
  const afterRestart = await consume(1)
  assert.equal(afterRestart.length, 1)
  record('database-outage-and-stateless-collector-restart', { databaseOffline: true, acceptedAndRetained: 1, localVolumeRequired: false })
  await request(`${relay}/control`, { loseNextResponse: true })
  const retryBody = metric()
  assert.equal((await request(collector, retryBody, headers)).status, 503)
  assert.equal((await request(collector, retryBody, headers)).status, 200)
  const duplicates = await consume(2)
  assert.deepEqual(duplicates[0], duplicates[1])
  record('queue-publish-ack-loss', { storedMessages: 2, logicalPointIdentities: 1, initialStatus: 503, retryStatus: 200 })
  const gzip = await request(collector, gzipSync(Buffer.from(JSON.stringify(metric()))), { ...headers, 'content-encoding': 'gzip' })
  assert.equal(gzip.status, 200)
  await consume(1)
  const sdk = await request(`${relay}/sdk`, { token: headers.authorization.slice(7) })
  assert.equal(sdk.status, 200, JSON.stringify(sdk))
  const [sdkMessage] = await consume(1)
  const histogram = sdkMessage.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram
  assert.equal(String(histogram.dataPoints[0].count), '3')
  assert.equal(histogram.dataPoints[0].explicitBounds.length, 14)
  record('real-sdk-protobuf-and-gzip', { sdk: '3.0.0', protobufObservations: 3, stableHttpBucketBounds: 14, jsonGzipStatus: 200 })
  const oversized = metric()
  oversized.resourceMetrics[0].scopeMetrics[0].metrics[0].name = 'x'.repeat(5_000_000)
  const oversizedResponse = await request(collector, gzipSync(Buffer.from(JSON.stringify(oversized))), { ...headers, 'content-encoding': 'gzip' })
  assert.ok([400, 413].includes(oversizedResponse.status), JSON.stringify(oversizedResponse))
  assert.match(JSON.stringify(oversizedResponse.body), /too large|limit|size|exceed/i)
  record('decompressed-request-limit', { decodedBytes: 5_000_000, compressedRequestStatus: oversizedResponse.status, response: oversizedResponse.body })
  const large = metric()
  const histogramData = large.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram
  const prototype = histogramData.dataPoints[0]
  histogramData.dataPoints=Array.from({length:1000},(_,i)=>({...prototype,timeUnixNano:String(9000+i)}))
  await request(`${relay}/control`,{failAfterChunk:1})
  assert.equal((await request(collector,large,headers)).status,503)
  assert.equal((await request(collector,large,headers)).status,200)
  const batchPoints=[]
  let queueMessages=0
  let maximumMessageBytes=0
  await until('large request and partial retry drained',async()=>{
    const batch=(await request(`${relay}/consume`,{})).body
    batchPoints.push(...batch.messages);queueMessages+=batch.queueMessages;maximumMessageBytes=Math.max(maximumMessageBytes,batch.maxMessageBytes)
    return batchPoints.length>=1000&&batch.queueMessages===0
  })
  const identities=new Set(batchPoints.map((m)=>m.resourceMetrics[0].scopeMetrics[0].metrics[0].histogram.dataPoints[0].timeUnixNano))
  assert.equal(identities.size,1000)
  assert.ok(batchPoints.length>1000)
  assert.ok(maximumMessageBytes<=240*1024)
  record('large-request-partial-publish-and-retry',{logicalPoints:1000,physicalPoints:batchPoints.length,queueMessages,maximumMessageBytes,firstStatus:503,retryStatus:200})
  const latencies = []
  const loadStart = performance.now()
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let i = 0; i < 125; i++) {
      const start = performance.now()
      assert.equal((await request(collector, metric(), headers)).status, 200)
      latencies.push(performance.now() - start)
    }
  }))
  const loadSeconds = (performance.now() - loadStart) / 1000
  latencies.sort((a,b)=>a-b)
  await consume(1000)
  const p95 = latencies[Math.ceil(latencies.length * 0.95)-1]
  assert.ok(p95 < 1500)
  record('bounded-local-admission-burst', { requests: 1000, concurrency: 8, delivered: 1000, elapsedSeconds: +loadSeconds.toFixed(2), requestsPerSecond: +(1000/loadSeconds).toFixed(1), p95Ms: +p95.toFixed(2), isCloudCapacityProof: false })
  await compose('stop', '-t', '1', 'queue')
  const unavailable = await request(collector, metric(), headers)
  assert.equal(unavailable.status, 503, JSON.stringify(unavailable))
  record('real-broker-outage-propagates', { status: 503, acknowledgedUnsavedData: false })
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  report.error = { message: error.message, stack: error.stack }
  process.exitCode = 1
  console.error(error)
} finally {
  await writeFile(`${artifacts}/stack.log`, await compose('logs', '--no-color').catch(String))
  report.cleanup = await compose('down', '-v', '--remove-orphans').then(() => 'removed only this unique project', String)
  report.finishedAt = new Date().toISOString()
  report.packageLockHash = createHash('sha256').update(await readFile(`${cwd}package-lock.json`)).digest('hex')
  await writeFile(`${artifacts}/results.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`Report: ${artifacts}/results.json (${report.status})`)
}
