export const clampNum = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export const fmtTick = (n: number) => {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`
  return String(Math.round(n))
}
