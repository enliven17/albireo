import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RouteBudget, normalizePath } from './normalize.ts'

const G = 'GBX7HQ6KH7UQ3RPZT2Y4Q5C4WJ6LVQZPJ2Q4QG4D2NWZK3F5Y3EQQ4ZD'
const C = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC'
const S = 'SB7ZQ5ZK3F5Y3EQQ4ZDGBX7HQ6KH7UQ3RPZT2Y4Q5C4WJ6LVQZPJ2Q4Q'
const M = 'MA7QYNF7SOWQ3GLR2BGMZEHXAVIRZA4KVWLTJJFC7MGXUA74P7UJUAAAAAAAAAAAPCICA'
const HASH = 'a'.repeat(64)

const CASES: [string, string][] = [
  [`/accounts/${G}`, '/accounts/:account'],
  [`/accounts/${G}/`, '/accounts/:account'],
  [`/contracts/${C}/events`, '/contracts/:contract/events'],
  [`/accounts/${M}`, '/accounts/:muxed'],
  [`/assets/USDC:${G}`, '/assets/:asset'],
  [`/assets/USDC-${G}`, '/assets/:asset'],
  [`/tx/${HASH}`, '/tx/:hash'],
  ['/ledgers/52341987/effects', '/ledgers/:id/effects'],
  ['/users/3f2b8c1e-7d4a-4c2b-9f1e-2a7b8c9d0e1f', '/users/:uuid'],
  ['/session/abc123DEF456ghi789', '/session/:token'],
  ['/quote?from=XLM&to=USDC', '/quote'],
  ['/', '/'],
  ['', '/'],
  ['//double//slash/', '/double/slash'],
  ['/docs/getting-started', '/docs/getting-started'],
]

test('normalizes stellar identifiers and common ids', () => {
  for (const [input, want] of CASES) assert.equal(normalizePath(input).route, want, input)
})

test('redacts secret seeds and flags them', () => {
  const r = normalizePath(`/import/${S}`)
  assert.equal(r.route, '/import/:REDACTED')
  assert.equal(r.redacted, true)
  assert.equal(normalizePath(`/accounts/${G}`).redacted, false)
})

test('route budget folds overflow into :other', () => {
  const b = new RouteBudget(2)
  assert.equal(b.admit('t', '/a'), '/a')
  assert.equal(b.admit('t', '/b'), '/b')
  assert.equal(b.admit('t', '/c'), ':other')
  assert.equal(b.admit('t', '/a'), '/a')
  assert.equal(b.admit('u', '/c'), '/c')
})
