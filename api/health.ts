import { json, measured } from '../services/api/http.ts'

export default measured((_req, res) => json(res, 200, { ok: true, node: process.version }))
