import { apiStats, sitesOf, trust, webStats } from '../services/api/stats.ts'
import { db, days, json, measured, query } from '../services/api/http.ts'

export default measured(async (req, res) => {
  const sql = await db()
  const n = days(query(req))
  const { rows } = await sql.query<{ id: string; name: string; category: string | null; scf_round: number | null; created_at: Date }>(
    `select id, name, category, scf_round, created_at from tenants where status = 'active' and public_card order by created_at`)
  const projects = await Promise.all(rows.map(async (t) => {
    const sites = await sitesOf(sql, t.id)
    const [web, api, tr] = await Promise.all([webStats(sql, sites, n), apiStats(sql, t.id, n), trust(sql, t.id, sites, n)])
    return {
      ...t,
      visitors: web.total, pageviews: web.pageviews, visitorSeries: web.visitors,
      requests: api.total, p95: api.p95, errorRate: api.errorRate,
      trust: tr.score, checks: tr.checks, filtered: tr.filtered,
    }
  }))
  json(res, 200, { days: n, projects }, 'public, max-age=60')
})
