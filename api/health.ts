import type { IncomingMessage, ServerResponse } from 'node:http'
import { normalizePath } from '../packages/core/normalize.ts'

export default function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ ok: true, node: process.version, sample: normalizePath(req.url ?? '/').route }))
}
