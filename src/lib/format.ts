export const fmt = (n: number | null | undefined) => {
  if (n === null || n === undefined) return 'n/a'
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`
  return Math.round(n).toLocaleString('en-US')
}
export const pct = (n: number | null | undefined, d = 1) => (n === null || n === undefined ? 'n/a' : `${(n * 100).toFixed(d)}%`)
export const dur = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`)
export const ms = (n: number | null | undefined) => (n === null || n === undefined ? 'n/a' : `${n} ms`)
export const short = (h: string, n = 6) => `${h.slice(0, n)}…${h.slice(-4)}`
export const ago = (iso: string, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
export const explorerTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`
export const explorerAccount = (id: string) => `https://stellar.expert/explorer/testnet/account/${id}`
