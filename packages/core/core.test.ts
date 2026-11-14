import { test } from 'node:test'
import assert from 'node:assert/strict'
import { RateLimiter, dropReason, hostAllowed } from './filter.ts'
import { DailySalt, visitorId } from './session.ts'
import { buildTree, canonical, proofFor, rootFromProof, sha256 } from './merkle.ts'
import { emptyHistogram, merge, observe, quantile } from './histogram.ts'

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

test('origin binding accepts verified domains and their subdomains only', () => {
  assert.ok(hostAllowed('halcyon.exchange', ['halcyon.exchange']))
  assert.ok(hostAllowed('app.halcyon.exchange', ['halcyon.exchange']))
  assert.ok(!hostAllowed('halcyon.exchange.evil.io', ['halcyon.exchange']))
  assert.ok(!hostAllowed('evilhalcyon.exchange', ['halcyon.exchange']))
})

test('drop reasons cover origin, bots, headless, datacenter and spam', () => {
  const ok = { hostname: 'halcyon.exchange', userAgent: CHROME, screen: { w: 1440, h: 900 } }
  const v = ['halcyon.exchange']
  assert.equal(dropReason(ok, v), null)
  assert.equal(dropReason({ ...ok, hostname: 'copycat.io' }, v), 'origin')
  assert.equal(dropReason({ ...ok, origin: 'https://copycat.io' }, v), 'origin')
  assert.equal(dropReason({ ...ok, userAgent: 'Googlebot/2.1' }, v), 'bot')
  assert.equal(dropReason({ ...ok, userAgent: null }, v), 'bot')
  assert.equal(dropReason({ ...ok, webdriver: true }, v), 'headless')
  assert.equal(dropReason({ ...ok, screen: { w: 0, h: 0 } }, v), 'headless')
  assert.equal(dropReason({ ...ok, asnClass: 'datacenter' }, v), 'datacenter')
  assert.equal(dropReason({ ...ok, referrer: 'https://semalt.com/x' }, v), 'referrer_spam')
})

test('rate limiter allows a burst then refills over time', () => {
  const rl = new RateLimiter(60, 3)
  const t = 1_000_000
  assert.deepEqual([rl.take('k', t), rl.take('k', t), rl.take('k', t), rl.take('k', t)], [true, true, true, false])
  assert.equal(rl.take('k', t + 1000), true)
  assert.equal(rl.take('other', t), true)
})

test('visitor ids are stable within a day and unlinkable across days', () => {
  let n = 0
  const salt = new DailySalt(() => Buffer.alloc(32, ++n))
  const day1 = Date.UTC(2026, 10, 13, 10)
  const a = visitorId(salt.current(day1), 's1', '1.2.3.4', CHROME)
  const b = visitorId(salt.current(day1 + 3_600_000), 's1', '1.2.3.4', CHROME)
  const c = visitorId(salt.current(day1 + 86_400_000), 's1', '1.2.3.4', CHROME)
  assert.equal(a, b)
  assert.notEqual(a, c)
  assert.notEqual(a, visitorId(salt.current(day1), 's2', '1.2.3.4', CHROME))
})

test('merkle proofs rebuild the root for every leaf, odd counts included', () => {
  for (const n of [1, 2, 3, 5, 11]) {
    const leaves = Array.from({ length: n }, (_, i) => sha256(canonical({ tenant: `t${i}`, visitors: i * 7 })))
    const { root, levels } = buildTree(leaves)
    leaves.forEach((leaf, i) => assert.equal(rootFromProof(leaf, proofFor(levels, i)), root, `n=${n} i=${i}`))
  }
  assert.throws(() => buildTree([]))
})

test('canonical json sorts keys at every level', () => {
  assert.equal(canonical({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } }), '{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}')
})

test('histogram quantiles land in the right bucket', () => {
  let h = emptyHistogram()
  for (let i = 0; i < 90; i++) h = observe(h, 40)
  for (let i = 0; i < 10; i++) h = observe(h, 600)
  const p50 = quantile(h, 0.5)!
  const p95 = quantile(h, 0.95)!
  assert.ok(p50 > 25 && p50 <= 50, `p50 ${p50}`)
  assert.ok(p95 > 500 && p95 <= 750, `p95 ${p95}`)
  assert.equal(merge(h, h).count, 200)
  assert.equal(quantile(emptyHistogram(), 0.5), null)
})
