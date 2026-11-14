import type { Sql } from '../shared/db.ts'
import { transaction } from '../shared/db.ts'
import { buildTree, canonical, proofFor, sha256 } from '../../packages/core/merkle.ts'
import { BOUNDS_MS, quantile } from '../../packages/core/histogram.ts'

// Daily seal: one canonical summary per active tenant, hashed into a Merkle tree whose root
// is written to Stellar with manage_data under the key albireo:YYYY-MM-DD.

export const DEFINITIONS = 'metrics-v1'
export const HORIZON = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org'

export async function summaries(sql: Sql, day: string) {
  const { rows: tenants } = await sql.query<{ id: string }>(`select id from tenants where status = 'active' order by id`)
  const out: { tenant: string; summary: string }[] = []
  for (const { id } of tenants) {
    const [web, api, b] = await Promise.all([
      sql.query<{ visitors: number; pageviews: number; events: number }>(
        `select count(distinct visitor)::int visitors, count(*) filter (where type = 'pageview')::int pageviews, count(*) filter (where type = 'event')::int events
           from events e join sites s on s.id = e.site_id where s.tenant_id = $1 and e.ts >= $2::date and e.ts < $2::date + 1`, [id, day]),
      sql.query<{ requests: number; errors: number }>(
        `select coalesce(sum(count), 0)::int requests, coalesce(sum(count) filter (where status_class = '5xx'), 0)::int errors
           from api_minute where tenant_id = $1 and minute >= $2::date and minute < $2::date + 1`, [id, day]),
      sql.query<{ i: number; v: number }>(
        `select u.i::int i, sum(u.b)::bigint v from api_minute, unnest(buckets) with ordinality u(b, i)
          where tenant_id = $1 and minute >= $2::date and minute < $2::date + 1 group by 1`, [id, day]),
    ])
    const counts = new Array(BOUNDS_MS.length + 1).fill(0)
    for (const r of b.rows) counts[r.i - 1] = Number(r.v)
    const h = { counts, sum: 0, count: counts.reduce((x, y) => x + y, 0) }
    out.push({
      tenant: id,
      summary: canonical({
        tenant: id, date: day, definitions: DEFINITIONS,
        visitors: web.rows[0].visitors, pageviews: web.rows[0].pageviews, events: web.rows[0].events,
        requests: api.rows[0].requests, errors_5xx: api.rows[0].errors,
        p50_ms: quantile(h, 0.5), p95_ms: quantile(h, 0.95),
      }),
    })
  }
  return out
}

/** computes and stores the seal for a day; idempotent, an existing seal is returned as is */
export async function seal(sql: Sql, day: string) {
  const existing = await sql.query<{ root: string; tx_hash: string | null; leaves: number }>('select root, tx_hash, leaves from seals where day = $1', [day])
  if (existing.rows[0]) return { day, ...existing.rows[0], created: false }
  const items = await summaries(sql, day)
  if (!items.length) throw new Error('no active tenants to seal')
  const leaves = items.map((x) => sha256(x.summary))
  const { root } = buildTree(leaves)
  await transaction(sql, async (q) => {
    await q.query('insert into seals (day, root, leaves) values ($1, $2, $3)', [day, root, leaves.length])
    for (let i = 0; i < items.length; i++) {
      await q.query('insert into seal_leaves (day, tenant_id, leaf, summary) values ($1, $2, $3, $4)', [day, items[i].tenant, leaves[i], items[i].summary])
    }
  })
  return { day, root, tx_hash: null, leaves: leaves.length, created: true }
}

/** writes the root to Stellar; the root is the 32 byte value of a manage_data entry */
export async function anchor(sql: Sql, day: string, secret = process.env.ANCHOR_SECRET) {
  if (!secret) throw new Error('ANCHOR_SECRET is not set')
  const { rows } = await sql.query<{ root: string; tx_hash: string | null }>('select root, tx_hash from seals where day = $1', [day])
  if (!rows[0]) throw new Error(`no seal for ${day}`)
  if (rows[0].tx_hash) return rows[0].tx_hash
  const sdk = await import('@stellar/stellar-sdk')
  const server = new sdk.Horizon.Server(HORIZON)
  const kp = sdk.Keypair.fromSecret(secret)
  const account = await server.loadAccount(kp.publicKey())
  const passphrase = HORIZON.includes('testnet') ? sdk.Networks.TESTNET : sdk.Networks.PUBLIC
  const tx = new sdk.TransactionBuilder(account, { fee: '1000', networkPassphrase: passphrase })
    .addOperation(sdk.Operation.manageData({ name: `albireo:${day}`, value: Buffer.from(rows[0].root, 'hex') }))
    .addMemo(sdk.Memo.text(`albireo seal ${day}`))
    .setTimeout(120)
    .build()
  tx.sign(kp)
  const res = await server.submitTransaction(tx)
  await sql.query('update seals set tx_hash = $2 where day = $1', [day, res.hash])
  return res.hash
}

export async function proof(sql: Sql, tenant: string, day: string) {
  const [s, l] = await Promise.all([
    sql.query<{ root: string; tx_hash: string | null }>('select root, tx_hash from seals where day = $1', [day]),
    sql.query<{ tenant_id: string; leaf: string; summary: string }>('select tenant_id, leaf, summary from seal_leaves where day = $1 order by tenant_id', [day]),
  ])
  if (!s.rows[0]) return null
  const index = l.rows.findIndex((r) => r.tenant_id === tenant)
  if (index < 0) return null
  const { levels, root } = buildTree(l.rows.map((r) => r.leaf))
  return {
    day,
    summary: l.rows[index].summary,
    leaf: l.rows[index].leaf,
    path: proofFor(levels, index),
    root,
    stored_root: s.rows[0].root,
    tx_hash: s.rows[0].tx_hash,
    account: process.env.ANCHOR_PUBLIC ?? null,
    horizon: HORIZON,
    data_key: `albireo:${day}`,
  }
}
