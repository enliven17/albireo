// Test-only queue relay; authentication is tested separately by api.test.ts and the OIDC lab.
// Production must combine BOTH boundaries; this intentionally public fixture is loopback-only.
import Fastify from 'fastify'
import { generateKeyPair, exportJWK, SignJWT } from 'jose'
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  AggregationTemporality,
  AggregationType,
} from '@opentelemetry/sdk-metrics'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  SQSClient,
  CreateQueueCommand,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs'
const sqsEndpoint = process.env.SQS_ENDPOINT ?? 'http://queue:9324'
const sqs = new SQSClient({
  region: 'eu-central-1',
  endpoint: sqsEndpoint,
  credentials: { accessKeyId: 'lab', secretAccessKey: 'lab' },
  maxAttempts: 1,
})
const queueUrl = (
  await sqs.send(new CreateQueueCommand({ QueueName: 'stellarcope-lab', Attributes: { VisibilityTimeout: '1' } }))
).QueueUrl
if (!queueUrl) throw new Error('No test queue URL')
// ElasticMQ returns localhost by default: use its actual Docker network endpoint.
const queue = queueUrl.replace('http://localhost:9324', sqsEndpoint)
let blocked = false
let loseNextResponse = false
let accepted = 0
let failAfterChunk = -1
const keys = await generateKeyPair('RS256')
const issuer = 'http://lab:8080/issuer'
const app = Fastify({ bodyLimit: 8 * 1024 * 1024, logger: false })
app.get('/health', async () => ({ accepted }))
app.get('/issuer/.well-known/openid-configuration', async () => ({
  issuer,
  jwks_uri: `${issuer}/keys`,
  id_token_signing_alg_values_supported: ['RS256'],
}))
app.get('/issuer/keys', async () => ({
  keys: [{ ...(await exportJWK(keys.publicKey)), kid: 'lab', alg: 'RS256', use: 'sig' }],
}))
app.post<{ Body: { tenant?: string; audience?: string; expires?: string } }>('/token', async (req) => ({
  token: await new SignJWT(req.body.tenant === undefined ? {} : { tenant_id: req.body.tenant })
    .setProtectedHeader({ alg: 'RS256', kid: 'lab' })
    .setIssuer(issuer)
    .setAudience(req.body.audience ?? 'ingest')
    .setIssuedAt()
    .setExpirationTime(req.body.expires ?? '10m')
    .sign(keys.privateKey),
}))
app.post<{ Body: { blocked?: boolean; loseNextResponse?: boolean; failAfterChunk?: number } }>(
  '/control',
  async (req) => {
    if (req.body.blocked !== undefined) blocked = req.body.blocked
    if (req.body.loseNextResponse !== undefined) loseNextResponse = req.body.loseNextResponse
    if (req.body.failAfterChunk !== undefined) failAfterChunk = req.body.failAfterChunk
    return { accepted }
  },
)
type Metric = { name?: string; histogram?: { dataPoints?: unknown[] }; sum?: { dataPoints?: unknown[] } }
type Scope = { metrics?: Metric[] }
type Resource = {
  resource?: { attributes?: { key: string; value?: { stringValue?: string } }[] }
  scopeMetrics?: Scope[]
}
function pack(resources: Resource[]) {
  const prefix = '{"version":1,"envelopes":['
  const suffix = ']}'
  const messages: string[] = []
  let points: string[] = []
  let bytes = Buffer.byteLength(prefix + suffix)
  for (const resource of resources)
    for (const scope of resource.scopeMetrics ?? [])
      for (const metric of scope.metrics ?? []) {
        const key = metric.histogram ? 'histogram' : 'sum'
        const data = metric[key]
        if (
          !data ||
          !['http.server.request.duration', 'http.server.duration', 'http.server.requests'].includes(
            metric.name ?? '',
          )
        )
          throw new Error('unsupported metric profile')
        for (const point of data.dataPoints ?? []) {
          const sanitizedPoint = { ...(point as Record<string, unknown>) }
          delete sanitizedPoint.exemplars
          const serialized = JSON.stringify({
            resourceMetrics: [
              {
                ...resource,
                scopeMetrics: [
                  { ...scope, metrics: [{ ...metric, [key]: { ...data, dataPoints: [sanitizedPoint] } }] },
                ],
              },
            ],
          })
          const size = Buffer.byteLength(serialized)
          if (size + Buffer.byteLength(prefix + suffix) > 240 * 1024)
            throw new Error('individual point exceeds queue envelope limit')
          if (bytes + size + 1 > 240 * 1024 && points.length) {
            messages.push(prefix + points.join(',') + suffix)
            points = []
            bytes = Buffer.byteLength(prefix + suffix)
          }
          points.push(serialized)
          bytes += size + 1
        }
      }
  if (points.length) messages.push(prefix + points.join(',') + suffix)
  return messages
}
app.post<{ Body: { resourceMetrics?: Resource[] } }>('/internal/v1/metrics', async (req, reply) => {
  const resources = req.body.resourceMetrics
  if (
    !resources?.length ||
    !resources.every((resource) =>
      /^tenant-[ab]$/.test(
        resource.resource?.attributes?.find((a) => a.key === 'tenant.id')?.value?.stringValue ?? '',
      ),
    )
  ) {
    return await reply.code(400).send({ message: 'verified tenant is required' })
  }
  if (blocked) return await reply.code(503).send({ message: 'injected queue outage' })
  let messages: string[]
  try {
    messages = pack(resources)
  } catch (error) {
    return await reply.code(400).send({ message: error instanceof Error ? error.message : 'invalid profile' })
  }
  try {
    const signal = AbortSignal.timeout(1000)
    for (let i = 0; i < messages.length; i++) {
      if (i === failAfterChunk) {
        failAfterChunk = -1
        throw new Error('injected partial publish')
      }
      await sqs.send(new SendMessageCommand({ QueueUrl: queue, MessageBody: messages[i] }), {
        abortSignal: signal,
      })
    }
    accepted++
    if (loseNextResponse) {
      loseNextResponse = false
      reply.raw.destroy()
      return
    }
    return {}
  } catch {
    return await reply.code(503).send({ message: 'queue unavailable' })
  }
})
app.post('/consume', async () => {
  const batch = await sqs.send(
    new ReceiveMessageCommand({ QueueUrl: queue, MaxNumberOfMessages: 10, WaitTimeSeconds: 0 }),
  )
  const messages = batch.Messages ?? []
  for (const message of messages)
    await sqs.send(new DeleteMessageCommand({ QueueUrl: queue, ReceiptHandle: message.ReceiptHandle }))
  const decoded = messages.map((m) => JSON.parse(m.Body ?? '{}') as { envelopes: unknown[] })
  return {
    messages: decoded.flatMap((m) => m.envelopes),
    queueMessages: messages.length,
    maxMessageBytes: Math.max(0, ...messages.map((m) => Buffer.byteLength(m.Body ?? ''))),
  }
})
app.get(
  '/queue',
  async () =>
    (
      await sqs.send(
        new GetQueueAttributesCommand({ QueueUrl: queue, AttributeNames: ['ApproximateNumberOfMessages'] }),
      )
    ).Attributes ?? {},
)
app.post<{ Body: { token: string } }>('/sdk', async (req) => {
  const exporter = new OTLPMetricExporter({
    url: 'http://collector:4318/v1/metrics',
    headers: { authorization: `Bearer ${req.body.token}` },
    temporalityPreference: AggregationTemporality.DELTA,
  })
  const provider = new MeterProvider({
    resource: resourceFromAttributes({ 'service.name': 'proto-lab', 'service.instance.id': 'proto-1' }),
    readers: [new PeriodicExportingMetricReader({ exporter, exportIntervalMillis: 60_000 })],
    views: [
      {
        instrumentName: 'http.server.request.duration',
        aggregation: {
          type: AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
          options: {
            boundaries: [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10],
          },
        },
      },
    ],
  })
  try {
    const histogram = provider
      .getMeter('proto-test')
      .createHistogram('http.server.request.duration', { unit: 's' })
    for (const value of [0.01, 0.05, 0.2])
      histogram.record(value, { 'http.route': '/prototype', 'http.response.status_code': 200 })
    await provider.forceFlush()
  } finally {
    await provider.shutdown()
  }
  return { recorded: 3, protocol: 'OTLP/HTTP Protobuf' }
})
await app.listen({ port: 8080, host: '0.0.0.0' })
