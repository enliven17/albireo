import { anchor, seal } from '../../services/api/seal.ts'
import { db, isDay, json, measured, query } from '../../services/api/http.ts'

// Daily at 00:30 UTC: seal yesterday and anchor the root on Stellar. Vercel cron sends the
// CRON_SECRET as a bearer token; anything else is refused.
export default measured(async (req, res) => {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return json(res, 401, { error: 'unauthorized' })
  const q = query(req).get('day')
  const day = isDay(q) ? q : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  const sql = await db()
  const s = await seal(sql, day)
  const tx = await anchor(sql, day)
  json(res, 200, { ...s, tx_hash: tx })
})
