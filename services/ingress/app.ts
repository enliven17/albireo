import Fastify, { LogController } from 'fastify'
import type { FastifyError, FastifyReply } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from 'typebox'
import { randomUUID } from 'node:crypto'
import type { Writable } from 'node:stream'
import type { IngressConfig } from './config.ts'
import { WebEventV1Schema } from '../../packages/ingestion/web.ts'

export const ErrorResponseSchema = Type.Object(
  { code: Type.String() },
  { additionalProperties: false },
)
export type AppOptions = { loggerStream?: Writable }

function createApp(config: IngressConfig, bodyLimit: number, options: AppOptions) {
  const app = Fastify({
    bodyLimit,
    connectionTimeout: 10000,
    requestTimeout: 10000,
    keepAliveTimeout: 5000,
    forceCloseConnections: 'idle',
    trustProxy: false,
    requestIdHeader: false,
    genReqId: () => randomUUID(),
    logController: new LogController({ disableRequestLogging: true }),
    logger: {
      level: config.logLevel,
      ...(options.loggerStream ? { stream: options.loggerStream } : {}),
      // Framework transport errors can contain raw packets; do not serialize them.
      serializers: {
        req: () => ({}),
        res: () => ({}),
        err: () => ({ type: 'Error', message: 'redacted', stack: '' }),
      },
    },
    ajv: { customOptions: { removeAdditional: false, coerceTypes: false, useDefaults: false } },
    frameworkErrors: (_error, _request, reply: FastifyReply) => {
      reply.code(400).send({ code: 'INVALID_REQUEST' })
    },
  }).withTypeProvider<TypeBoxTypeProvider>()
  app.removeContentTypeParser('text/plain')
  app.addHook('onRequest', async (request, reply) => {
    const encoding = request.headers['content-encoding']
    if (encoding !== undefined && encoding.toLowerCase() !== 'identity') {
      return reply.code(415).send({ code: 'UNSUPPORTED_MEDIA_TYPE' })
    }
  })
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('cache-control', 'no-store')
    return payload
  })
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    const status =
      error.statusCode === 413
        ? 413
        : error.statusCode === 415
          ? 415
          : error.statusCode === 400 || error.validation
            ? 400
            : 500
    const code =
      status === 413
        ? 'PAYLOAD_TOO_LARGE'
        : status === 415
          ? 'UNSUPPORTED_MEDIA_TYPE'
          : status === 400
            ? 'INVALID_REQUEST'
            : 'INTERNAL_ERROR'
    if (status === 500) app.log.error({ code, requestId: request.id }, 'Ingress request failed')
    return reply.code(status).send({ code })
  })
  app.setNotFoundHandler((_request, reply) => reply.code(404).send({ code: 'NOT_FOUND' }))
  app.get(
    '/health/live',
    {
      schema: {
        response: {
          200: Type.Object({ status: Type.Literal('ok') }, { additionalProperties: false }),
        },
      },
    },
    (_request, reply) => {
      reply.send({ status: 'ok' })
    },
  )
  app.get(
    '/health/ready',
    {
      schema: {
        response: {
          503: Type.Object({ status: Type.Literal('not_ready') }, { additionalProperties: false }),
        },
      },
    },
    async (_request, reply) => reply.code(503).send({ status: 'not_ready' }),
  )
  return app
}

export function createIngressApps(config: IngressConfig, options: AppOptions = {}) {
  const publicApp = createApp(config, config.publicBodyLimit, options)
  const privateApp = createApp(config, config.privateBodyLimit, options)
  publicApp.post(
    '/v1/events',
    {
      schema: { body: WebEventV1Schema, response: { 503: ErrorResponseSchema } },
    },
    async (_request, reply) =>
      reply.header('retry-after', '60').code(503).send({ code: 'INGESTION_NOT_CONFIGURED' }),
  )
  privateApp.post(
    '/internal/v1/metrics',
    {
      schema: { response: { 503: ErrorResponseSchema } },
    },
    async (_request, reply) =>
      reply.header('retry-after', '60').code(503).send({ code: 'INGESTION_NOT_CONFIGURED' }),
  )
  return { publicApp, privateApp }
}
