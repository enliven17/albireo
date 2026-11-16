import { db, json, measured, query } from '../services/api/http.ts'

export default measured(async (req, res) => {
  const tenant = query(req).get('tenant') ?? 'stellarcope'
  const sql = await db()
  const { rows } = await sql.query(
    `select to_char(s.day, 'YYYY-MM-DD') as day, s.root, s.tx_hash, s.leaves, l.leaf
       from seals s join seal_leaves l on l.day = s.day and l.tenant_id = $1
      order by s.day desc limit 14`, [tenant])
  json(res, 200, { seals: rows, account: process.env.ANCHOR_PUBLIC ?? null }, 'public, max-age=300')
})
