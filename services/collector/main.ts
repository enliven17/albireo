import { createServer } from 'node:http'
import { connect } from '../shared/db.ts'
import { dbSites } from '../shared/sites.ts'
import { Spool } from '../shared/spool.ts'
import { collector } from './server.ts'

const sql = await connect()
const spool = new Spool(process.env.SPOOL_DIR ?? 'spool')
const { handle } = collector({ sites: dbSites(sql), spool })
const port = Number(process.env.PORT ?? 8080)

const server = createServer((req, res) => void handle(req, res))
server.listen(port, () => console.log(`collector on :${port}`))

// flush the in-memory buffer before exiting so a deploy never drops events
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => server.close(async () => { await spool.flush(); process.exit(0) }))
}
