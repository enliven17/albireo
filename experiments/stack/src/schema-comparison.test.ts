import test from 'node:test'
import assert from 'node:assert/strict'
import { Type } from '@fastify/type-provider-typebox'
import { Compile } from 'typebox/compile'
import { z } from 'zod'
import Fastify from 'fastify'
import swagger from '@fastify/swagger'
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from '@fastify/type-provider-zod'
import SwaggerParser from '@apidevtools/swagger-parser'
import { performance } from 'node:perf_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

test('current TypeBox and Zod boundary behavior plus bounded validation comparison', async () => {
  const typebox = Compile(
    Type.Object(
      { name: Type.String({ minLength: 1, maxLength: 64 }), count: Type.Integer({ minimum: 0 }) },
      { additionalProperties: false },
    ),
  )
  const zod = z.strictObject({ name: z.string().min(1).max(64), count: z.number().int().nonnegative() })
  for (const [input, expected] of [
    [{ name: 'page', count: 4 }, true],
    [{ name: '', count: 4 }, false],
    [{ name: 'page', count: '4' }, false],
    [{ name: 'page', count: 4, secret: 'x' }, false],
    [{ name: 'page', count: -1 }, false],
  ] as const) {
    assert.equal(typebox.Check(input), expected)
    assert.equal(zod.safeParse(input).success, expected)
  }
  const input = { name: 'page', count: 4 }
  const result: Record<string, number> = {}
  // Only a local microbenchmark; no architecture choice rests on this timing alone.
  for (const [name, validate] of [
    ['typebox', () => typebox.Check(input)],
    ['zod', () => zod.safeParse(input).success],
  ] as const) {
    for (let i = 0; i < 10_000; i++) validate()
    const start = performance.now()
    for (let i = 0; i < 100_000; i++) assert.equal(validate(), true)
    result[name] = Math.round((performance.now() - start) * 100) / 100
  }
  console.log(
    JSON.stringify({ experiment: 'validation_microbenchmark', iterations: 100_000, elapsedMs: result }),
  )

  const app = Fastify().withTypeProvider<ZodTypeProvider>()
  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)
  await app.register(swagger, {
    openapi: { openapi: '3.0.3', info: { title: 'Zod comparison', version: '1' } },
    transform: jsonSchemaTransform,
  })
  app.post(
    '/check',
    { schema: { body: zod, response: { 200: z.strictObject({ accepted: z.boolean() }) } } },
    async (req) => ({ accepted: req.body.count >= 0 }),
  )
  try {
    assert.equal((await app.inject({ method: 'POST', url: '/check', payload: input })).statusCode, 200)
    assert.equal(
      (await app.inject({ method: 'POST', url: '/check', payload: { ...input, secret: 'x' } })).statusCode,
      400,
    )
    await mkdir(new URL('../results/', import.meta.url), { recursive: true })
    const specPath = new URL('../results/openapi-zod.json', import.meta.url)
    await writeFile(specPath, JSON.stringify(app.swagger()))
    await SwaggerParser.validate(fileURLToPath(specPath))
  } finally {
    await app.close()
  }
})
