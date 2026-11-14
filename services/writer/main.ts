import { connect, migrate } from '../shared/db.ts'
import { Spool } from '../shared/spool.ts'
import { drain } from './writer.ts'

const sql = await connect()
await migrate(sql)
const spool = new Spool(process.env.SPOOL_DIR ?? 'spool')
const every = Number(process.env.DRAIN_MS ?? 5000)

async function tick() {
  try {
    const r = await drain(sql, spool)
    if (r.files) console.log(`drained ${r.files} files, ${r.events} events, ${r.drops} drops`)
  } catch (err) {
    console.error('drain failed, files kept for retry', err)
  }
  setTimeout(tick, every)
}
void tick()
