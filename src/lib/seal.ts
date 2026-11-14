// Browser side proof check: hash the published summary, walk the Merkle path, then read the
// root that was written to Stellar straight from Horizon and compare.

const enc = new TextEncoder()
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const bytes = (h: string) => new Uint8Array(h.match(/../g)!.map((b) => parseInt(b, 16)))

export const sha256 = async (data: string | Uint8Array) =>
  hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? enc.encode(data) : (data as BufferSource)))

const pair = async (a: string, b: string) => {
  const joined = new Uint8Array(64)
  joined.set(bytes(a), 0)
  joined.set(bytes(b), 32)
  return sha256(joined)
}

export async function walk(leaf: string, path: { hash: string; side: 'left' | 'right' }[]) {
  let h = leaf
  for (const step of path) h = step.side === 'left' ? await pair(step.hash, h) : await pair(h, step.hash)
  return h
}

/** the 32 byte value stored under albireo:YYYY-MM-DD on the anchor account, as hex */
export async function ledgerRoot(horizon: string, account: string, key: string) {
  const res = await fetch(`${horizon}/accounts/${account}/data/${encodeURIComponent(key)}`)
  if (!res.ok) return null
  const { value } = (await res.json()) as { value: string }
  return [...atob(value)].map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')
}
