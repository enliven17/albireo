// Deterministic demo data. Every number on the demo pages comes from here, seeded by
// project slug, so screens stay stable between visits and match the public cards.

export type Category = 'Wallet' | 'DeFi' | 'Anchor' | 'Payments' | 'Infra' | 'NFT'

export type Project = {
  slug: string
  name: string
  domain: string
  category: Category
  round: number
  visitors: number // daily baseline
  requests: number // daily API baseline, 0 when no API is instrumented
  p95: number
  botRate: number
  checks: { sep1: boolean; dns: boolean; origin: boolean; sealed: boolean }
}

const ok = { sep1: true, dns: true, origin: true, sealed: true }

export const PROJECTS: Project[] = [
  { slug: 'halcyon-dex', name: 'Halcyon DEX', domain: 'halcyon.exchange', category: 'DeFi', round: 41, visitors: 4200, requests: 182000, p95: 212, botRate: 0.04, checks: ok },
  { slug: 'kestrel-wallet', name: 'Kestrel Wallet', domain: 'kestrelwallet.app', category: 'Wallet', round: 38, visitors: 6900, requests: 264000, p95: 168, botRate: 0.03, checks: ok },
  { slug: 'meridian-anchor', name: 'Meridian Anchor', domain: 'meridian.money', category: 'Anchor', round: 36, visitors: 2100, requests: 96000, p95: 341, botRate: 0.02, checks: { ...ok, dns: false } },
  { slug: 'tidepool', name: 'Tidepool Lend', domain: 'tidepool.fi', category: 'DeFi', round: 43, visitors: 1800, requests: 54000, p95: 274, botRate: 0.07, checks: { ...ok, sep1: false } },
  { slug: 'vega-payroll', name: 'Vega Payroll', domain: 'vegapayroll.com', category: 'Payments', round: 40, visitors: 950, requests: 31000, p95: 189, botRate: 0.02, checks: ok },
  { slug: 'nova-remit', name: 'Nova Remit', domain: 'novaremit.io', category: 'Payments', round: 44, visitors: 3100, requests: 0, p95: 0, botRate: 0.05, checks: ok },
  { slug: 'ion-oracle', name: 'Ion Oracle', domain: 'ionoracle.dev', category: 'Infra', round: 39, visitors: 640, requests: 412000, p95: 96, botRate: 0.01, checks: { ...ok, sep1: false } },
  { slug: 'cirrus-sdk', name: 'Cirrus SDK', domain: 'cirrus.build', category: 'Infra', round: 42, visitors: 1200, requests: 128000, p95: 121, botRate: 0.03, checks: { ...ok, sep1: false } },
  { slug: 'polaris-mint', name: 'Polaris Mint', domain: 'polarismint.art', category: 'NFT', round: 37, visitors: 1500, requests: 0, p95: 0, botRate: 0.18, checks: { ...ok, sep1: false, origin: false } },
  { slug: 'lyra-vault', name: 'Lyra Vault', domain: 'lyravault.xyz', category: 'DeFi', round: 45, visitors: 2600, requests: 73000, p95: 236, botRate: 0.06, checks: ok },
  { slug: 'orbit-pay', name: 'Orbit Pay', domain: 'orbitpay.co', category: 'Payments', round: 45, visitors: 1900, requests: 46000, p95: 205, botRate: 0.04, checks: { ...ok, dns: false, sealed: false } },
  { slug: 'quasar-bridge', name: 'Quasar Bridge', domain: 'quasarbridge.net', category: 'Infra', round: 41, visitors: 2300, requests: 158000, p95: 288, botRate: 0.09, checks: ok },
]

export const bySlug = (slug: string) => PROJECTS.find((p) => p.slug === slug)

// mulberry32, seeded from a string
export function rng(seed: string) {
  let h = 1779033703
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 3432918353) >>> 0
  return () => {
    h = (h + 0x6d2b79f5) >>> 0
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type Point = { date: number; value: number }
export type Share = { label: string; share: number }

const DAY = 86_400_000
export const TODAY = Date.UTC(2026, 10, 13)

/** daily series ending yesterday: weekly rhythm, slow growth, noise and one launch spike */
export function daily(seed: string, base: number, days: number): Point[] {
  const r = rng(seed)
  const spike = Math.floor(r() * days)
  return Array.from({ length: days }, (_, i) => {
    const date = TODAY - (days - 1 - i) * DAY
    const dow = new Date(date).getUTCDay()
    const week = dow === 0 || dow === 6 ? 0.78 : 1 + 0.06 * Math.sin(dow)
    const growth = 0.82 + 0.18 * (i / Math.max(1, days - 1))
    const noise = 0.9 + r() * 0.2
    const lift = Math.abs(i - spike) < 2 ? 1.5 - Math.abs(i - spike) * 0.2 : 1
    return { date, value: Math.round(base * week * growth * noise * lift) }
  })
}

export const total = (xs: Point[]) => xs.reduce((a, b) => a + b.value, 0)

const shares = (r: () => number, rows: [string, number][], jitter = 0.25): Share[] =>
  rows.map(([label, share]) => ({ label, share: share * (1 - jitter / 2 + r() * jitter) }))

export function webStats(p: Project, days: number) {
  const visitors = daily(`${p.slug}:v`, p.visitors, days)
  const prev = daily(`${p.slug}:v:prev`, p.visitors * 0.9, days)
  const r = rng(`${p.slug}:web`)
  const perVisit = 2.2 + r() * 1.2
  return {
    visitors,
    total: total(visitors),
    delta: total(visitors) / total(prev) - 1,
    pageviews: Math.round(total(visitors) * perVisit),
    bounce: 0.32 + r() * 0.22,
    session: 95 + Math.round(r() * 160),
    pages: shares(r, [['/', 0.34], ['/swap', 0.18], ['/pools', 0.12], ['/portfolio', 0.1], ['/docs/quickstart', 0.08], ['/rewards', 0.06]]),
    referrers: shares(r, [['Direct', 0.38], ['x.com', 0.17], ['stellar.org', 0.12], ['github.com', 0.1], ['google.com', 0.09], ['communityfund.stellar.org', 0.07]]),
    countries: shares(r, [['Nigeria', 0.16], ['United States', 0.14], ['Argentina', 0.11], ['Germany', 0.08], ['Brazil', 0.08], ['Philippines', 0.07]], 0.4),
    devices: shares(r, [['Mobile', 0.58], ['Desktop', 0.38], ['Tablet', 0.04]], 0),
  }
}

export function apiStats(p: Project, days: number) {
  const requests = daily(`${p.slug}:r`, p.requests, days)
  const r = rng(`${p.slug}:api`)
  const latency = requests.map((d, i) => ({ date: d.date, value: Math.round(p.p95 * (0.85 + r() * 0.3) * (i % 9 === 4 ? 1.35 : 1)) }))
  const err = 0.004 + r() * 0.012
  const routes: [string, number, number][] = [
    ['GET /accounts/:account', 0.29, 0.8], ['GET /tx/:hash', 0.19, 0.9], ['POST /quote', 0.15, 1.3],
    ['GET /assets/:asset', 0.12, 0.7], ['GET /contracts/:contract/events', 0.09, 1.6], ['POST /submit', 0.06, 2.1],
  ]
  return {
    requests,
    latency,
    total: total(requests),
    errorRate: err,
    p50: Math.round(p.p95 * 0.38),
    p95: p.p95,
    status: [
      { label: '2xx', share: 0.948 - err },
      { label: '3xx', share: 0.021 },
      { label: '4xx', share: 0.031 },
      { label: '5xx', share: err },
    ],
    routes: routes.map(([label, share, k]) => ({ label, share, p50: Math.round(p.p95 * 0.38 * k), p95: Math.round(p.p95 * k) })),
  }
}

export function walletStats(p: Project) {
  const r = rng(`${p.slug}:wallets`)
  const open = Math.round(p.visitors * 9 * (0.8 + r() * 0.3))
  const connected = Math.round(open * (0.58 + r() * 0.12))
  const requested = Math.round(connected * (0.62 + r() * 0.1))
  const signed = Math.round(requested * (0.81 + r() * 0.1))
  return {
    funnel: [
      { label: 'wallet_modal_open', value: open },
      { label: 'wallet_connected', value: connected },
      { label: 'tx_sign_requested', value: requested },
      { label: 'tx_signed', value: signed },
    ],
    share: shares(r, [['Freighter', 0.41], ['xBull', 0.17], ['LOBSTR', 0.15], ['Albedo', 0.1], ['Hana', 0.09], ['Rabet', 0.08]], 0.3),
  }
}

export function trustScore(p: Project) {
  const c = p.checks
  const checks = Number(c.sep1) * 12 + Number(c.dns) * 8 + Number(c.origin) * 15 + Number(c.sealed) * 10
  return Math.round(Math.max(0, Math.min(100, 45 + checks - p.botRate * 120 + (p.requests ? 6 : 0))))
}

export const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}K` : n.toLocaleString('en-US')
export const pct = (n: number, d = 1) => `${(n * 100).toFixed(d)}%`
export const dur = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
export const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)
