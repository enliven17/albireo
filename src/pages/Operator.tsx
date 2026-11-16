import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import Nav from '../components/Nav'
import DemoTabs from '../components/DemoTabs'
import { Shimmer, Sparkline } from '../components/viz'
import { AnimatedNumber, Card, CardHead, Check } from '../components/dash/core'
import { useApi, type Project } from '../lib/api'
import { fmt, ms, pct } from '../lib/format'
import { reducedMotion } from '../lib/smooth'

type Key = 'name' | 'visitors' | 'requests' | 'p95' | 'filtered' | 'trust'
const COLUMNS: { key: Key; label: string }[] = [
  { key: 'name', label: 'Project' },
  { key: 'visitors', label: 'Visitors' },
  { key: 'requests', label: 'API requests' },
  { key: 'p95', label: 'p95' },
  { key: 'filtered', label: 'Filtered' },
  { key: 'trust', label: 'Trust' },
]
const SERIES = ['var(--color-gold)', 'var(--color-blue)', 'var(--color-ink)', 'var(--color-mute)']

function Compare({ projects }: { projects: Project[] }) {
  const W = 1000, H = 220
  const max = Math.max(1, ...projects.flatMap((p) => p.visitorSeries.map((d) => d.value))) * 1.1
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block h-[220px] w-full" role="img" aria-label="Visitors per day for the selected projects">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgb(236 234 228 / .06)" vectorEffect="non-scaling-stroke" />)}
        {projects.map((p, i) => (
          <path key={p.id} fill="none" stroke={SERIES[i]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeDasharray={i === 3 ? '4 4' : undefined}
            d={p.visitorSeries.map((d, j) => `${j ? 'L' : 'M'}${(j / Math.max(1, p.visitorSeries.length - 1)) * W} ${H - (d.value / max) * (H - 8)}`).join('')} />
        ))}
      </svg>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {projects.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 font-mono text-[12px] text-mute">
            <svg width="18" height="2" aria-hidden><line x1="0" x2="18" y1="1" y2="1" stroke={SERIES[i]} strokeWidth="2" /></svg>{p.name}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function Operator() {
  const { data, error } = useApi<{ days: number; projects: Project[] }>('/api/projects?days=30', 60_000)
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: 'trust', dir: -1 })
  const [picked, setPicked] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const body = useRef<HTMLElement>(null)

  useEffect(() => { document.title = 'Operator view on Stellarcope' }, [])
  useEffect(() => { if (data && !picked.length) setPicked(data.projects.slice(0, 3).map((p) => p.id)) }, [data, picked.length])

  const rows = useMemo(() => {
    const list = (data?.projects ?? []).filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
    return [...list].sort((a, b) => {
      const x = a[sort.key] ?? 0, y = b[sort.key] ?? 0
      return (typeof x === 'string' ? x.localeCompare(String(y)) : Number(x) - Number(y)) * sort.dir
    })
  }, [data, sort, filter])

  const totals = useMemo(() => {
    const p = data?.projects ?? []
    return { n: p.length, visitors: p.reduce((a, x) => a + x.visitors, 0), requests: p.reduce((a, x) => a + x.requests, 0), sealed: p.filter((x) => x.checks.sealed).length }
  }, [data])

  const ready = !!data
  useLayoutEffect(() => {
    if (!body.current || reducedMotion() || !ready) return
    gsap.fromTo(body.current.querySelectorAll('tbody tr'), { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, ease: 'power3.out', stagger: 0.03 })
  }, [ready])

  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((s) => s !== id) : cur.length >= 4 ? cur : [...cur, id]))
  const order = (key: Key) => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))

  return (
    <>
      <Nav />
      <DemoTabs note="live data" />
      <main id="main" ref={body} className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 sm:px-8">
        <h1 className="text-[clamp(2rem,4.5vw,3.4rem)] leading-none">Stellar ecosystem</h1>
        <p className="mt-3 text-sm text-mute">Every enrolled project on the same yardstick, last 30 days.</p>

        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Enrolled projects', v: totals.n },
            { label: 'Visitors', v: totals.visitors },
            { label: 'API requests', v: totals.requests },
            { label: 'Sealed recently', v: totals.sealed },
          ].map((k) => (
            <Card key={k.label} className="p-5">
              <CardHead title={k.label} />
              <div className="mt-4"><AnimatedNumber value={data ? k.v : null} className="text-[clamp(1.8rem,2.6vw,2.4rem)] leading-none" /></div>
            </Card>
          ))}
        </div>

        <div className="hair mt-10 flex flex-wrap items-center justify-between gap-4 border-b pb-3">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter projects" aria-label="Filter projects"
            className="hair w-64 border bg-transparent px-3 py-2 font-mono text-[12px] text-ink outline-none placeholder:text-dim focus:border-[rgb(236_234_228/.4)]" />
          <p className="font-mono text-[11px] text-dim">tick up to 4 rows to compare</p>
        </div>

        {error && <p className="mt-6 text-sm text-mute">Could not load projects: {error}</p>}
        {!data && !error && <div className="mt-6"><Shimmer rows={5} /></div>}
        {data && (
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="hair border-b">
                  <th className="w-10 py-3"><span className="sr-only">Compare</span></th>
                  {COLUMNS.map((c) => (
                    <th key={c.key} className="py-3 pr-4 font-normal" aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => order(c.key)} className={`label transition-colors hover:text-ink ${sort.key === c.key ? 'text-ink' : ''}`}>{c.label} {sort.key === c.key ? (sort.dir === 1 ? '↑' : '↓') : ''}</button>
                    </th>
                  ))}
                  <th className="label py-3 pr-4 font-normal">Trend</th>
                  <th className="label py-3 pr-4 font-normal">Verified</th>
                  <th className="label py-3 pr-4 font-normal">Sealed</th>
                  <th className="py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const on = picked.includes(p.id)
                  return (
                    <tr key={p.id} className={`hair border-b transition-colors hover:bg-raise ${on ? 'bg-panel' : ''}`}>
                      <td className="py-3">
                        <input type="checkbox" checked={on} onChange={() => toggle(p.id)} aria-label={`Compare ${p.name}`}
                          className="h-4 w-4 cursor-pointer appearance-none border border-[rgb(236_234_228/.3)] checked:border-gold checked:bg-gold" />
                      </td>
                      <td className="py-3 pr-4">{p.name} {p.category && <span className="ml-2 font-mono text-[11px] text-dim">{p.category}</span>}</td>
                      <td className="num py-3 pr-4">{fmt(p.visitors)}</td>
                      <td className="num py-3 pr-4">{fmt(p.requests)}</td>
                      <td className="num py-3 pr-4">{ms(p.p95)}</td>
                      <td className={`num py-3 pr-4 ${p.filtered > 0.1 ? 'text-bad' : 'text-mute'}`}>{pct(p.filtered)}</td>
                      <td className="num py-3 pr-4 text-gold">{p.trust}</td>
                      <td className="py-3 pr-4"><Sparkline data={p.visitorSeries} width={90} height={24} /></td>
                      <td className="py-3 pr-4"><Check on={p.checks.origin} /></td>
                      <td className="py-3 pr-4"><Check on={p.checks.sealed} /></td>
                      <td className="py-3 text-right"><Link to={`/demo?tenant=${p.id}`} className="font-mono text-[12px] text-mute hover:text-ink">open →</Link></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-6">
            <CardHead title="Compare visitors per day" />
            <div className="mt-5">{data && picked.length ? <Compare projects={picked.map((id) => data.projects.find((p) => p.id === id)!).filter(Boolean)} /> : <p className="text-sm text-mute">Tick rows above to compare them here.</p>}</div>
          </Card>
          <Card className="p-6">
            <CardHead title="Enroll a project" />
            <p className="mt-5 text-sm leading-relaxed text-mute">Enrollment is open to Stellar projects. Sign in with a wallet, prove the domain, paste the snippet. The project appears here with its first event.</p>
            <Link to="/docs/quickstart" className="btn mt-6">Read the quickstart <span className="arrow">→</span></Link>
          </Card>
        </div>
      </main>
    </>
  )
}
