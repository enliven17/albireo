import type { IncomingMessage, ServerResponse } from 'node:http'
import { collector } from '../services/collector/server.ts'
import { dbSites } from '../services/shared/sites.ts'
import { dbSalt } from '../services/shared/salt.ts'
import type { Record } from '../services/shared/spool.ts'
import { persist } from '../services/writer/writer.ts'
import { db, measured } from '../services/api/http.ts'

// Serverless ingestion: records are written straight to Postgres after the 202 is sent.
// ponytail: no spool in serverless; the long running collector keeps the durable spool path
const pending: Record[] = []
let instance: ReturnType<typeof collector> | null = null

export default measured(async (req: IncomingMessage, res: ServerResponse) => {
  const sql = await db()
  instance ??= collector({ sites: dbSites(sql), spool: { push: (r) => void pending.push(r) }, salt: dbSalt(sql) })
  await instance.handle(req, res)
  const batch = pending.splice(0)
  if (batch.length) await persist(sql, batch)
})
