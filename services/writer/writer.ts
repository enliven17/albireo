import { transaction, type Sql } from '../shared/db.ts'
import type { Record, Spool } from '../shared/spool.ts'

// Drains closed spool files into Postgres. A file is deleted only after its rows are
// committed, so a crash replays the file instead of losing it.
// ponytail: replay after a crash mid-commit can duplicate one file of events; add an
// ingest id with a unique index if exact once matters more than simplicity

type EventData = {
  type: string; name: string | null; path: string; referrer: string | null
  utm_source: string | null; utm_medium: string | null; utm_campaign: string | null
  country: string | null; browser: string; os: string; device: string; visitor: string
  props: unknown
}

const BATCH = 500

async function insertEvents(sql: Sql, rows: Extract<Record, { kind: 'event' }>[]) {
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH)
    const params: unknown[] = []
    const values = chunk.map((r) => {
      const d = r.data as EventData
      params.push(r.site, r.ts, d.type, d.name, d.path, d.referrer, d.utm_source, d.utm_medium, d.utm_campaign, d.country, d.browser, d.os, d.device, d.visitor, d.props ? JSON.stringify(d.props) : null)
      const b = params.length - 15
      return `(${Array.from({ length: 15 }, (_, k) => `$${b + k + 1}`).join(',')})`
    })
    await sql.query(
      `insert into events (site_id, ts, type, name, path, referrer, utm_source, utm_medium, utm_campaign, country, browser, os, device, visitor, props) values ${values.join(',')}`,
      params,
    )
  }
}

async function upsertDrops(sql: Sql, rows: Extract<Record, { kind: 'drop' }>[]) {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const k = `${r.site}\u0000${r.day}\u0000${r.reason}`
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  for (const [k, n] of counts) {
    const [site, day, reason] = k.split('\u0000')
    await sql.query(
      `insert into drops (site_id, day, reason, count) values ($1, $2, $3, $4)
       on conflict (site_id, day, reason) do update set count = drops.count + excluded.count`,
      [site, day, reason, n],
    )
  }
}

/** writes one batch of spooled records atomically */
export async function persist(sql: Sql, records: Record[]) {
  const ev = records.filter((r): r is Extract<Record, { kind: 'event' }> => r.kind === 'event')
  const dr = records.filter((r): r is Extract<Record, { kind: 'drop' }> => r.kind === 'drop')
  if (!ev.length && !dr.length) return { events: 0, drops: 0 }
  await transaction(sql, async (q) => {
    await insertEvents(q, ev)
    await upsertDrops(q, dr)
  })
  return { events: ev.length, drops: dr.length }
}

export async function drain(sql: Sql, spool: Spool, now = Date.now()) {
  let files = 0, events = 0, drops = 0
  for (const file of await spool.closed(now)) {
    const r = await persist(sql, await spool.read(file))
    await spool.remove(file)
    files++
    events += r.events
    drops += r.drops
  }
  return { files, events, drops }
}
