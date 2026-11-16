import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AddressInfo } from 'node:net'
import { PGlite } from '@electric-sql/pglite'
import { collector, parsePayload, scrubProps } from './server.ts'
import { staticSites } from '../shared/sites.ts'
import { Spool } from '../shared/spool.ts'
import { migrate, type Sql } from '../shared/db.ts'
import { drain } from '../writer/writer.ts'

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const view = (over: Record<string, unknown> = {}) => JSON.stringify({ site: 'hx_7f3a', type: 'pageview', path: '/swap', hostname: 'halcyon.exchange', screen: { w: 390, h: 844 }, ...over })

test('payload validation rejects malformed and oversized fields', () => {
  assert.ok(parsePayload(view()))
  assert.equal(parsePayload('not json'), null)
  assert.equal(parsePayload(view({ path: 'swap' })), null)
  assert.equal(parsePayload(view({ type: 'click' })), null)
  assert.equal(parsePayload(view({ type: 'event' })), null)
  assert.equal(parsePayload(view({ site: 'x'.repeat(65) })), null)
})

test('event props are flattened and personal values masked', () => {
  const p = scrubProps({ pair: 'XLM/USDC', amount: 12, ok: true, email: 'a@b.co', who: 'GBX7HQ6KH7UQ3RPZT2Y4Q5C4WJ6LVQZPJ2Q4QG4D2NWZK3F5Y3EQQ4ZD', nested: { a: 1 } })
  assert.deepEqual(p, { pair: 'XLM/USDC', amount: 12, ok: true, email: '[masked]', who: '[masked]' })
})

test('collector to spool to postgres, with filtering counted', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'stellarcope-spool-'))
  const spool = new Spool(dir)
  const t0 = Date.UTC(2026, 10, 14, 12, 0, 5)
  const { handle, stats } = collector({ sites: staticSites({ hx_7f3a: { tenantId: 'halcyon', domains: ['halcyon.exchange'] } }), spool, now: () => t0 })
  const server = createServer((req, res) => void handle(req, res)).listen(0)
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const post = (body: string, headers: Record<string, string> = {}) =>
    fetch(`${base}/e`, { method: 'POST', body, headers: { 'user-agent': UA, origin: 'https://halcyon.exchange', 'content-type': 'text/plain', 'x-forwarded-for': '203.0.113.7', 'cf-ipcountry': 'NG', ...headers } })

  try {
    const codes = await Promise.all([
      post(view()),
      post(view({ path: '/pools' })),
      post(view({ type: 'event', name: 'quote_requested', props: { pair: 'XLM/USDC' } })),
      post(view(), { origin: 'https://copycat.io' }),
      post(view(), { 'user-agent': 'Googlebot/2.1' }),
      post(view({ webdriver: true })),
      post(view({ site: 'unknown' })),
      post('garbage'),
    ]).then((rs) => rs.map((r) => r.status))
    assert.ok(codes.every((c) => c === 202), 'always 202')
    assert.deepEqual({ ...stats }, { accepted: 3, dropped: 3, invalid: 2 })

    const js = await fetch(`${base}/t/1.0.0/a.js`)
    assert.equal(js.status, 200)
    assert.match(js.headers.get('cache-control') ?? '', /immutable/)
    assert.equal((await fetch(`${base}/t/../a.js`)).status, 404)
  } finally {
    server.close()
  }

  await spool.flush(t0)
  const db = new PGlite()
  const sql = db as unknown as Sql
  await migrate(sql)
  const r = await drain(sql, spool, t0 + 60_000)
  assert.deepEqual(r, { files: 1, events: 3, drops: 3 })
  assert.deepEqual(await spool.closed(t0 + 120_000), [], 'drained files are removed')

  const { rows } = await sql.query<{ type: string; path: string; country: string; device: string; browser: string; visitor: string }>('select type, path, country, device, browser, visitor from events order by path')
  assert.equal(rows.length, 3)
  assert.deepEqual(rows.map((x) => x.path), ['/pools', '/swap', '/swap'])
  assert.ok(rows.every((x) => x.country === 'NG' && x.device === 'Mobile' && x.browser === 'Safari'))
  assert.equal(new Set(rows.map((x) => x.visitor)).size, 1, 'one visitor, same day')
  assert.ok(!JSON.stringify(rows).includes('203.0.113.7'), 'ip never stored')

  const drops = await sql.query<{ reason: string; count: number }>('select reason, count::int as count from drops order by reason')
  assert.deepEqual(drops.rows, [{ reason: 'bot', count: 1 }, { reason: 'headless', count: 1 }, { reason: 'origin', count: 1 }])
  await db.close()
})
