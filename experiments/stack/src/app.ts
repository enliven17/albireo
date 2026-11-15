// Throwaway HTTP boundary fixture. Not the Albireo application.
import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { jwtVerify } from 'jose'
import type { CryptoKey } from 'jose'
import { Event, Receipt, Failure, type Admission } from './contracts.ts'
import { admit } from './practices.ts'

export async function makeApp(
  publicKey: CryptoKey,
  publish: (admission: Admission, signal: AbortSignal) => Promise<void>,
) {
  const app = Fastify({
    bodyLimit: 32 * 1024,
    logger: false,
    ajv: { customOptions: { coerceTypes: false, removeAdditional: false, useDefaults: false } },
  }).withTypeProvider<TypeBoxTypeProvider>()
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Albireo decision fixture', version: '1' },
      components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    },
  })
  app.addContentTypeParser('text/plain', { parseAs: 'string' }, (_request, body, done) => {
    try {
      done(null, JSON.parse(String(body)) as unknown)
    } catch {
      done(Object.assign(new Error('invalid beacon JSON'), { statusCode: 400 }))
    }
  })
  const tenantByRequest = new WeakMap<object, string>()
  app.addHook('onRequest', async (request, reply) => {
    try {
      const bearer = request.headers.authorization
      if (!bearer?.startsWith('Bearer ')) return await reply.code(401).send({ error: 'unauthorized' })
      const { payload } = await jwtVerify(bearer.slice(7), publicKey, {
        issuer: 'albireo-lab',
        audience: 'ingest',
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'tenant_id'],
      })
      if (typeof payload.tenant_id !== 'string' || !/^tenant-[ab]$/.test(payload.tenant_id))
        return await reply.code(403).send({ error: 'forbidden' })
      tenantByRequest.set(request, payload.tenant_id)
    } catch {
      return await reply.code(401).send({ error: 'unauthorized' })
    }
  })
  app.post(
    '/e',
    {
      schema: {
        body: Event,
        response: { 202: Receipt, 401: Failure, 503: Failure },
        security: [{ bearer: [] }],
      },
    },
    async (request, reply) => {
      const tenant = tenantByRequest.get(request)
      if (!tenant) return await reply.code(401).send({ error: 'unauthorized' })
      try {
        await admit(async (signal) => {
          await publish({ tenant, event: request.body }, signal)
        })
      } catch {
        return await reply.code(503).send({ error: 'admission unavailable' })
      }
      // Deliberate private extra field: response serialization must remove it.
      const internalReceipt = {
        accepted: true as const,
        eventId: request.body.eventId,
        internalToken: 'must-not-leak',
      }
      return await reply.code(202).send(internalReceipt)
    },
  )
  await app.ready()
  return app
}
