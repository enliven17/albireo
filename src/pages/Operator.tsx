import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AppBar from '../components/AppBar'
import { GlyphBars, Stat } from '../components/charts'
import { Check } from '../sections/Reviewers'
import { PROJECTS, daily, fmt, pct, trustScore, walletStats, type Category, type Project } from '../lib/data'

const CATEGORIES: ('All' | Category)[] = ['All', 'DeFi', 'Wallet', 'Payments', 'Anchor', 'Infra', 'NFT']
const SERIES = ['var(--color-gold)', 'var(--color-blue)', 'var(--color-ink)', 'var(--color-mute)']
type Key = 'name' | 'visitors' | 'requests' | 'p95' | 'botRate' | 'trust'

const COLUMNS: { key: Key; label: string; num?: boolean }[] = [
  { key: 'name', label: 'Project' },
  { key: 'visitors', label: 'Visitors / day', num: true },
  { key: 'requests', label: 'API / day', num: true },
  { key: 'p95', label: 'p95', num: true },
  { key: 'botRate', label: 'Filtered', num: true },
  { key: 'trust', label: 'Trust', num: true },
]

const value = (p: Project, k: Key) => (k === 'trust' ? trustScore(p) : p[k])

const ANOMALIES = [
  { time: '13:42', project: 'Polaris Mint', text: 'Traffic 6.1x above its 14 day baseline, 71% from two datacenter networks' },
  { time: '11:05', project: 'Orbit Pay', text: 'DNS verification missing for 3 days, sealing paused' },
  { time: '09:18', project: 'Quasar Bridge', text: 'p95 latency on POST /submit rose to 612 ms' },
  { time: '07:56', project: 'Tidepool Lend', text: 'Possible secret key in a request path, value redacted, team notified' },
]

function Compare({ projects }: { projects: Project[] }) {
  const W = 1000, H = 220
  const series = projects.map((p) => daily(`${p.slug}:v`, p.visitors, 30))
  const max = Math.max(...series.flat().map((d) => d.value)) * 1.1
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[220px] w-full" role="img" aria-label="Visitors per day for the selected projects">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgb(236 234 228 / .06)" vectorEffect="non-scaling-stroke" />)}
        {series.map((s, i) => (
          <path key={projects[i].slug} fill="none" stroke={SERIES[i]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray={i === 3 ? '4 4' : undefined}
            d={s.map((d, j) => `${j ? 'L' : 'M'}${(j / 29) * W} ${H - (d.value / max) * (H - 8)}`).join('')} />
        ))}
      </svg>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {projects.map((p, i) => (
          <li key={p.slug} className="flex items-center gap-2 font-mono text-[12px] text-mute">
            <svg width="18" height="2" aria-hidden><line x1="0" x2="18" y1="1" y2="1" stroke={SERIES[i]} strokeWidth="2" strokeDasharray={i === 3 ? '4 3' : undefined} /></svg>
            {p.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Operator() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All')
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'trust', dir: -1 })
  const [picked, setPicked] = useState<string[]>(['halcyon-dex', 'kestrel-wallet', 'lyra-vault'])

  useEffect(() => { document.title = 'Operator view on Albireo' }, [])

  const rows = useMemo(() => {
    const list = PROJECTS.filter((p) => category === 'All' || p.category === category)
    return [...list].sort((a, b) => {
      const x = value(a, sort.key), y = value(b, sort.key)
      return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.dir
    })
  }, [category, sort])

  const totals = useMemo(() => ({
    projects: PROJECTS.length,
    visitors: PROJECTS.reduce((a, p) => a + p.visitors, 0) * 30,
    requests: PROJECTS.reduce((a, p) => a + p.requests, 0) * 30,
    sealed: PROJECTS.filter((p) => p.checks.sealed).length,
  }), [])

  const share = useMemo(() => {
    const acc = new Map<string, number>()
    for (const p of PROJECTS) for (const w of walletStats(p).share) acc.set(w.label, (acc.get(w.label) ?? 0) + w.share * p.visitors)
    const sum = [...acc.values()].reduce((a, b) => a + b, 0)
    return [...acc].map(([label, v]) => ({ label, share: v / sum })).sort((a, b) => b.share - a.share)
  }, [])

  const toggle = (slug: string) =>
    setPicked((cur) => (cur.includes(slug) ? cur.filter((s) => s !== slug) : cur.length >= 4 ? cur : [...cur, slug]))
  const order = (key: Key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))

  return (
    <>
      <AppBar />
      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 sm:px-8">
        <p className="label">Operator view</p>
        <h1 className="mt-3 text-[clamp(1.8rem,4vw,2.8rem)] font-medium tracking-tight">Stellar ecosystem, last 30 days</h1>

        <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          <Stat label="Enrolled projects" value={String(totals.projects)} />
          <Stat label="Visitors" value={fmt(totals.visitors)} tone="gold" note="all projects" />
          <Stat label="API requests" value={fmt(totals.requests)} tone="blue" note="all projects" />
          <Stat label="Sealed yesterday" value={`${totals.sealed} of ${totals.projects}`} />
        </div>

        <div className="hair mt-12 flex flex-wrap items-center justify-between gap-4 border-b pb-3">
          <div role="group" aria-label="Category" className="flex flex-wrap gap-4">
            {CATEGORIES.map((c) => <button key={c} type="button" className="tab" aria-pressed={category === c} onClick={() => setCategory(c)}>{c}</button>)}
          </div>
          <p className="font-mono text-[11px] text-dim">select up to 4 rows to compare</p>
        </div>

        <div className="overflow-x-auto" data-lenis-prevent>
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead>
              <tr className="hair border-b">
                <th className="w-10 py-3"><span className="sr-only">Compare</span></th>
                {COLUMNS.map((c) => (
                  <th key={c.key} className="py-3 pr-4 font-normal" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" onClick={() => order(c.key)} className={`label transition-colors hover:text-ink ${sort.key === c.key ? 'text-ink' : ''}`}>
                      {c.label} {sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : ''}
                    </button>
                  </th>
                ))}
                <th className="label py-3 pr-4 font-normal">SEP-1</th>
                <th className="label py-3 pr-4 font-normal">Sealed</th>
                <th className="py-3"><span className="sr-only">Open</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const on = picked.includes(p.slug)
                return (
                  <tr key={p.slug} className={`hair border-b transition-colors hover:bg-raise ${on ? 'bg-panel' : ''}`}>
                    <td className="py-3">
                      <input type="checkbox" checked={on} onChange={() => toggle(p.slug)} aria-label={`Compare ${p.name}`}
                        className="h-4 w-4 cursor-pointer appearance-none border border-[rgb(236_234_228/.3)] checked:border-gold checked:bg-gold" />
                    </td>
                    <td className="py-3 pr-4"><span>{p.name}</span> <span className="ml-2 font-mono text-[11px] text-dim">{p.category}</span></td>
                    <td className="num py-3 pr-4">{fmt(p.visitors)}</td>
                    <td className="num py-3 pr-4">{p.requests ? fmt(p.requests) : <span className="text-dim">n/a</span>}</td>
                    <td className="num py-3 pr-4">{p.p95 ? `${p.p95} ms` : <span className="text-dim">n/a</span>}</td>
                    <td className={`num py-3 pr-4 ${p.botRate > 0.1 ? 'text-bad' : 'text-mute'}`}>{pct(p.botRate)}</td>
                    <td className="num py-3 pr-4 text-gold">{trustScore(p)}</td>
                    <td className="py-3 pr-4"><Check on={p.checks.sep1} /></td>
                    <td className="py-3 pr-4"><Check on={p.checks.sealed} /></td>
                    <td className="py-3 text-right"><Link to={`/demo?project=${p.slug}`} className="font-mono text-[12px] text-mute hover:text-ink">open →</Link></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <section className="hair border bg-panel p-5 sm:p-6">
            <h2 className="label">Compare visitors per day</h2>
            <div className="mt-5">{picked.length ? <Compare projects={picked.map((s) => PROJECTS.find((p) => p.slug === s)!)} /> : <p className="text-sm text-mute">Pick rows above to compare them here.</p>}</div>
          </section>
          <section className="hair border bg-panel p-5 sm:p-6">
            <h2 className="label">Wallet share, ecosystem</h2>
            <div className="mt-5"><GlyphBars rows={share} /></div>
          </section>
        </div>

        <section className="hair mt-4 border bg-panel p-5 sm:p-6">
          <h2 className="label">Anomalies, today</h2>
          <ul className="mt-5">
            {ANOMALIES.map((a) => (
              <li key={a.time} className="hair grid gap-1 border-t py-3 text-sm sm:grid-cols-[5rem_10rem_1fr] sm:gap-4">
                <span className="num text-mute">{a.time}</span>
                <span>{a.project}</span>
                <span className="text-mute">{a.text}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  )
}
