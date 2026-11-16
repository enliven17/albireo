import { apiStats, sitesOf, trust, walletStats, webStats } from '../services/api/stats.ts'
import { db, days, json, measured, query } from '../services/api/http.ts'

export default measured(async (req, res) => {
  const q = query(req)
  const tenant = q.get('tenant') ?? 'stellarcope'
  const sql = await db()
  const { rows } = await sql.query<{ id: string; name: string; category: string | null; scf_round: number | null }>(
    `select id, name, category, scf_round from tenants where id = $1 and status = 'active' and public_card`, [tenant])
  if (!rows[0]) return json(res, 404, { error: 'unknown tenant' })
  const n = days(q)
  const sites = await sitesOf(sql, tenant)
  const [web, api, wallets, t] = await Promise.all([webStats(sql, sites, n), apiStats(sql, tenant, n), walletStats(sql, sites, n), trust(sql, tenant, sites, n)])
  json(res, 200, { tenant: rows[0], days: n, web, api, wallets, trust: t }, 'public, max-age=30')
})
