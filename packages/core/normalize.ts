// Route normalization for API analytics. A fixed, ordered rule set: the first rule that
// matches a path segment wins. Stellar identifiers collapse into readable placeholders so
// routes stay low cardinality and never carry account data.

export type Normalized = { route: string; redacted: boolean }

const RULES: [RegExp, string][] = [
  [/^S[A-Z2-7]{55}$/, ':REDACTED'], // secret seed, must never be stored
  [/^M[A-Z2-7]{68}$/, ':muxed'],
  [/^G[A-Z2-7]{55}$/, ':account'],
  [/^C[A-Z2-7]{55}$/, ':contract'],
  [/^[A-Za-z0-9]{1,12}[:-]G[A-Z2-7]{55}$/, ':asset'],
  [/^[0-9a-fA-F]{64}$/, ':hash'],
  [/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, ':uuid'],
  [/^\d+$/, ':id'],
  [/^(?=.*\d)[A-Za-z0-9_-]{16,}$/, ':token'],
]

export function normalizePath(raw: string): Normalized {
  let path = raw
  const q = path.search(/[?#]/)
  if (q >= 0) path = path.slice(0, q)
  let redacted = false
  const parts = path.split('/').map((seg) => {
    if (!seg) return seg
    let s = seg
    try { s = decodeURIComponent(seg) } catch { /* keep raw segment */ }
    for (const [re, placeholder] of RULES) {
      if (re.test(s)) {
        if (placeholder === ':REDACTED') redacted = true
        return placeholder
      }
    }
    return seg
  })
  let route = parts.join('/').replace(/\/{2,}/g, '/')
  if (route.length > 1) route = route.replace(/\/+$/, '')
  return { route: route || '/', redacted }
}

/** caps distinct routes per tenant; anything past the cap folds into :other */
export class RouteBudget {
  private seen = new Map<string, Set<string>>()
  private limit: number
  constructor(limit = 500) { this.limit = limit }
  admit(tenant: string, route: string) {
    let set = this.seen.get(tenant)
    if (!set) this.seen.set(tenant, (set = new Set()))
    if (set.has(route)) return route
    if (set.size >= this.limit) return ':other'
    set.add(route)
    return route
  }
}
