import { proof } from '../services/api/seal.ts'
import { db, isDay, json, measured, query } from '../services/api/http.ts'

export default measured(async (req, res) => {
  const q = query(req)
  const tenant = q.get('tenant') ?? 'stellarcope'
  const day = q.get('day')
  const sql = await db()
  const target = isDay(day) ? day : (await sql.query<{ day: string }>(`select to_char(max(day), 'YYYY-MM-DD') as day from seal_leaves where tenant_id = $1`, [tenant])).rows[0]?.day
  if (!target) return json(res, 404, { error: 'not sealed yet' })
  const p = await proof(sql, tenant, target)
  if (!p) return json(res, 404, { error: 'not sealed yet' })
  json(res, 200, p, 'public, max-age=300')
})
