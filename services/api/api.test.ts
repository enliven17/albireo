import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PGlite } from '@electric-sql/pglite'
import { migrate, type Sql } from '../shared/db.ts'
import { apiStats, live, trust, walletStats, webStats } from './stats.ts'
import { proof, seal } from './seal.ts'
import { rootFromProof, sha256 } from '../../packages/core/merkle.ts'

test('stats, seal and proof against real queries', async () => {
  const pg = new PGlite()
  const sql = pg as unknown as Sql
  await migrate(sql)
  await sql.query(`insert into tenants (id, name, public_card) values ('albireo', 'Albireo', true), ('other', 'Other', true)`)
  await sql.query(`insert into sites values ('s1', 'albireo'), ('s2', 'other')`)
  await sql.query(`insert into domains (tenant_id, domain, method, token, verified_at) values ('albireo', 'albireo.test', 'meta', 't', now())`)

  const today = new Date().toISOString().slice(0, 10)
  const ev = (site: string, visitor: string, path: string, offsetSec: number, type = 'pageview', name: string | null = null, props: unknown = null) =>
    sql.query(`insert into events (site_id, ts, type, name, path, country, browser, os, device, visitor, props) values ($1, now() - ($2 || ' seconds')::interval, $3, $4, $5, 'TR', 'Chrome', 'macOS', 'Desktop', $6, $7)`,
      [site, String(offsetSec), type, name, path, visitor, props ? JSON.stringify(props) : null])
  await ev('s1', 'v1', '/', 300)
  await ev('s1', 'v1', '/docs', 120)
  await ev('s1', 'v2', '/', 60)
  await ev('s1', 'v2', '/', 50, 'event', 'wallet_connected', { wallet_id: 'freighter' })
  await ev('s2', 'v9', '/', 10)
  await sql.query(`insert into drops values ('s1', current_date, 'bot', 2)`)
  const buckets = (i: number, n: number) => { const b = new Array(15).fill(0); b[i] = n; return b }
  await sql.query(`insert into api_minute values ('albireo', 'api', 'GET /stats', '2xx', date_trunc('minute', now()) - interval '2 minutes', 8, 400, $1)`, [buckets(3, 8)])
  await sql.query(`insert into api_minute values ('albireo', 'api', 'GET /stats', '5xx', date_trunc('minute', now()) - interval '2 minutes', 2, 1500, $1)`, [buckets(8, 2)])

  const web = await webStats(sql, ['s1'], 7)
  assert.equal(web.total, 2)
  assert.equal(web.pageviews, 3)
  assert.equal(web.visitors.length, 7)
  assert.equal(web.bounce, 0.5)
  assert.equal(web.pages[0].label, '/')
  assert.ok(web.session > 0)
  assert.equal(web.heatmap.length, 7)
  assert.equal(web.heatmap.flat().reduce((a, b) => a + b, 0), 3)

  const api = await apiStats(sql, 'albireo', 7)
  assert.equal(api.total, 10)
  assert.equal(api.errorRate, 0.2)
  assert.ok(api.p50! > 25 && api.p50! <= 50)
  assert.ok(api.p95! > 500)
  assert.equal(api.routes[0].label, 'GET /stats')

  const w = await walletStats(sql, ['s1'], 7)
  assert.equal(w.funnel[1].value, 1)
  assert.equal(w.share[0].label, 'freighter')

  const t = await trust(sql, 'albireo', ['s1'], 7)
  assert.equal(t.checks.meta, true)
  assert.equal(t.checks.sealed, false)
  assert.ok(t.filtered > 0.3 && t.filtered < 0.35)

  const l = await live(sql, ['s1'])
  assert.equal(l.events.length, 4)
  assert.equal(l.active, 2)
  assert.ok(!JSON.stringify(l).includes('v1'), 'live feed never exposes visitor hashes')

  const s = await seal(sql, today)
  assert.equal(s.leaves, 2)
  assert.equal((await seal(sql, today)).created, false, 'idempotent')
  const p = (await proof(sql, 'albireo', today))!
  assert.equal(sha256(p.summary), p.leaf)
  assert.equal(rootFromProof(p.leaf, p.path), p.stored_root)
  assert.deepEqual(JSON.parse(p.summary).visitors, 2)
  assert.ok((await trust(sql, 'albireo', ['s1'], 7)).checks.sealed)
  await pg.close()
})
