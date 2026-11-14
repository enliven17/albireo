import { PROJECTS, apiStats, day, webStats, type Project } from './data'

// The daily seal: each project's canonical summary becomes a SHA-256 leaf, leaves are sorted
// by slug and folded into one Merkle root. In production the root is written to Stellar with
// manage_data; the demo computes the same thing in the browser.
export const METRICS_VERSION = 'metrics-v1.2'

const enc = new TextEncoder()
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const bytes = (h: string) => new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)))

export const sha256 = async (data: string | Uint8Array) =>
  hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : data))

const pair = async (a: string, b: string) => {
  const joined = new Uint8Array(64)
  joined.set(bytes(a), 0)
  joined.set(bytes(b), 32)
  return sha256(joined)
}

export function summary(p: Project, date: number) {
  const web = webStats(p, 1)
  const api = apiStats(p, 1)
  // keys in fixed order so the JSON is canonical
  return JSON.stringify({
    project: p.slug,
    date: day(date),
    visitors: web.total,
    pageviews: web.pageviews,
    requests: api.total,
    p50_ms: p.requests ? api.p50 : null,
    p95_ms: p.requests ? api.p95 : null,
    definitions: METRICS_VERSION,
  })
}

export type Proof = { leaf: string; path: { hash: string; side: 'left' | 'right' }[]; root: string }

export async function prove(slug: string, date: number): Promise<Proof> {
  const sealed = PROJECTS.filter((p) => p.checks.sealed).sort((a, b) => a.slug.localeCompare(b.slug))
  let level = await Promise.all(sealed.map((p) => sha256(summary(p, date))))
  let index = sealed.findIndex((p) => p.slug === slug)
  const leaf = level[index]
  const path: Proof['path'] = []
  while (level.length > 1) {
    if (level.length % 2) level = [...level, level[level.length - 1]]
    const sibling = index ^ 1
    path.push({ hash: level[sibling], side: sibling < index ? 'left' : 'right' })
    const next: string[] = []
    for (let i = 0; i < level.length; i += 2) next.push(await pair(level[i], level[i + 1]))
    level = next
    index >>= 1
  }
  return { leaf, path, root: level[0] }
}

/** walk a proof back up to the root, the check a reviewer runs */
export async function verify(leaf: string, path: Proof['path']) {
  let h = leaf
  for (const step of path) h = step.side === 'left' ? await pair(step.hash, h) : await pair(h, step.hash)
  return h
}

export const short = (h: string, n = 6) => `${h.slice(0, n)}…${h.slice(-4)}`
