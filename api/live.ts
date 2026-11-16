import { live, sitesOf } from '../services/api/stats.ts'
import { db, json, measured, query } from '../services/api/http.ts'

export default measured(async (req, res) => {
  const sql = await db()
  const tenant = query(req).get('tenant') ?? 'stellarcope'
  const { rows } = await sql.query('select 1 from tenants where id = $1 and public_card', [tenant])
  if (!rows[0]) return json(res, 404, { error: 'unknown tenant' })
  json(res, 200, await live(sql, await sitesOf(sql, tenant)), 'public, max-age=5')
})
