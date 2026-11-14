// Latency histograms. Explicit bucket bounds in milliseconds, compatible with the
// OpenTelemetry default http.server.request.duration boundaries (converted to ms).
export const BOUNDS_MS = [5, 10, 25, 50, 75, 100, 250, 500, 750, 1000, 2500, 5000, 7500, 10000]

export type Histogram = { counts: number[]; sum: number; count: number }

export const emptyHistogram = (): Histogram => ({ counts: new Array(BOUNDS_MS.length + 1).fill(0), sum: 0, count: 0 })

export function observe(h: Histogram, ms: number): Histogram {
  let i = BOUNDS_MS.findIndex((b) => ms <= b)
  if (i < 0) i = BOUNDS_MS.length
  const counts = h.counts.slice()
  counts[i] += 1
  return { counts, sum: h.sum + ms, count: h.count + 1 }
}

export function merge(a: Histogram, b: Histogram): Histogram {
  return { counts: a.counts.map((c, i) => c + (b.counts[i] ?? 0)), sum: a.sum + b.sum, count: a.count + b.count }
}

/** quantile by linear interpolation inside the bucket that holds the rank */
export function quantile(h: Histogram, q: number): number | null {
  if (!h.count) return null
  const rank = q * h.count
  let seen = 0
  for (let i = 0; i < h.counts.length; i++) {
    const c = h.counts[i]
    if (seen + c >= rank && c > 0) {
      const lo = i === 0 ? 0 : BOUNDS_MS[i - 1]
      const hi = i < BOUNDS_MS.length ? BOUNDS_MS[i] : BOUNDS_MS[BOUNDS_MS.length - 1] * 2
      return Math.round(lo + ((rank - seen) / c) * (hi - lo))
    }
    seen += c
  }
  return BOUNDS_MS[BOUNDS_MS.length - 1]
}
