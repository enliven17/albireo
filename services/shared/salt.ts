import { randomBytes } from 'node:crypto'
import type { Sql } from './db.ts'

/** daily salt shared by every collector instance through the database; past days are deleted */
export function dbSalt(sql: Sql) {
  let cached: { day: string; salt: Buffer } | null = null
  return {
    async current(now = Date.now()) {
      const day = new Date(now).toISOString().slice(0, 10)
      if (cached?.day === day) return cached.salt
      await sql.query('insert into salts (day, salt) values ($1, $2) on conflict (day) do nothing', [day, randomBytes(32)])
      const { rows } = await sql.query<{ salt: Buffer | Uint8Array }>('select salt from salts where day = $1', [day])
      await sql.query('delete from salts where day < $1', [day])
      cached = { day, salt: Buffer.from(rows[0].salt) }
      return cached.salt
    },
  }
}
