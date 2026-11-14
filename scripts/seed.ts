// Enrolls Albireo as its own first tenant and verifies its domain for real.
// Usage: npm run seed   (needs DATABASE_URL and VERIFY_TOKEN in .env.local)
import { connect, migrate } from '../services/shared/db.ts'
import { checkMeta } from '../services/verifier/verify.ts'

const DOMAIN = process.env.SITE_DOMAIN ?? 'albireo-theta.vercel.app'
const token = process.env.VERIFY_TOKEN
if (!token) throw new Error('VERIFY_TOKEN is not set')

const sql = await connect()
await migrate(sql)
await sql.query(`insert into tenants (id, name, category, public_card) values ('albireo', 'Albireo', 'Infra', true) on conflict (id) do nothing`)
await sql.query(`insert into sites (id, tenant_id) values ('alb_main', 'albireo') on conflict (id) do nothing`)
await sql.query(`insert into domains (tenant_id, domain, method, token) values ('albireo', $1, 'meta', $2)
                 on conflict (tenant_id, domain) do update set token = excluded.token`, [DOMAIN, token])
const ok = await checkMeta(DOMAIN, token)
await sql.query(`update domains set last_checked_at = now(), verified_at = case when $3 then coalesce(verified_at, now()) else null end
                 where tenant_id = 'albireo' and domain = $1 and token = $2`, [DOMAIN, token, ok])
await sql.query(`insert into audit_log (actor, action, target, detail) values ('seed', 'verify_domain', $1, $2)`, [DOMAIN, JSON.stringify({ method: 'meta', ok })])
console.log(`${DOMAIN} meta verification: ${ok ? 'verified' : 'not verified yet'}`)
await (sql as unknown as { end(): Promise<void> }).end()
