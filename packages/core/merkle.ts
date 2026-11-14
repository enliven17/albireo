import { createHash } from 'node:crypto'

// Daily seal tree. Leaves are SHA-256 of canonical summaries, sorted by tenant id; an odd
// level repeats its last node. Same construction as the browser verifier on the public card.

export const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
const pair = (a: string, b: string) => sha256(Buffer.concat([Buffer.from(a, 'hex'), Buffer.from(b, 'hex')]))

export type ProofStep = { hash: string; side: 'left' | 'right' }

/** stable JSON: keys sorted at every level */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`
  }
  return JSON.stringify(value ?? null)
}

export function buildTree(leaves: string[]) {
  if (!leaves.length) throw new Error('cannot seal an empty day')
  const levels = [leaves]
  while (levels[levels.length - 1].length > 1) {
    const cur = levels[levels.length - 1]
    const padded = cur.length % 2 ? [...cur, cur[cur.length - 1]] : cur
    const next: string[] = []
    for (let i = 0; i < padded.length; i += 2) next.push(pair(padded[i], padded[i + 1]))
    levels.push(next)
  }
  return { root: levels[levels.length - 1][0], levels }
}

export function proofFor(levels: string[][], index: number): ProofStep[] {
  const path: ProofStep[] = []
  let i = index
  for (let l = 0; l < levels.length - 1; l++) {
    const level = levels[l]
    const sibling = i ^ 1
    path.push({ hash: level[sibling] ?? level[i], side: sibling < i ? 'left' : 'right' })
    i >>= 1
  }
  return path
}

export function rootFromProof(leaf: string, path: ProofStep[]) {
  return path.reduce((h, s) => (s.side === 'left' ? pair(s.hash, h) : pair(h, s.hash)), leaf)
}
