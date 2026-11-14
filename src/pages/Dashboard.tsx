import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Nav from '../components/Nav'
import DemoTabs from '../components/DemoTabs'
import { AreaChart, GlyphBars, Stat } from '../components/charts'
import { Check } from '../sections/Reviewers'
import { PROJECTS, TODAY, apiStats, bySlug, day, dur, fmt, pct, trustScore, walletStats, webStats, type Project } from '../lib/data'
import { prove, short } from '../lib/seal'

const RANGES = [7, 30, 90] as const
const TABS = ['Web', 'API', 'Wallets', 'Trust'] as const
type Tab = (typeof TABS)[number]

function Panel({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`hair border bg-panel p-5 sm:p-6 ${className}`}>
      <h2 className="label">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function WebTab({ p, days }: { p: Project; days: number }) {
  const s = useMemo(() => webStats(p, days), [p, days])
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        <Stat label="Visitors" value={fmt(s.total)} note={`${s.delta >= 0 ? '+' : ''}${pct(s.delta)} vs previous`} tone={s.delta >= 0 ? 'gold' : 'bad'} />
        <Stat label="Page views" value={fmt(s.pageviews)} note={`${(s.pageviews / s.total).toFixed(2)} per visitor`} />
        <Stat label="Bounce rate" value={pct(s.bounce)} />
        <Stat label="Avg session" value={dur(s.session)} />
      </div>
      <Panel title="Visitors per day"><AreaChart data={s.visitors} tone="gold" /></Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top pages"><GlyphBars rows={s.pages} /></Panel>
        <Panel title="Referrers"><GlyphBars rows={s.referrers} /></Panel>
        <Panel title="Countries"><GlyphBars rows={s.countries} /></Panel>
        <Panel title="Devices"><GlyphBars rows={s.devices} /></Panel>
      </div>
    </div>
  )
}

function ApiTab({ p, days }: { p: Project; days: number }) {
  const s = useMemo(() => apiStats(p, days), [p, days])
  if (!p.requests) {
    return (
      <Panel title="API analytics">
        <p className="max-w-lg text-sm leading-relaxed text-mute">{p.name} has not connected an API yet. Add the second OpenTelemetry exporter and request volume, status codes and latency appear here within a minute.</p>
        <Link to="/#install" className="btn mt-6">See the OpenTelemetry snippet <span className="arrow">→</span></Link>
      </Panel>
    )
  }
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        <Stat label="Requests" value={fmt(s.total)} note={`${fmt(Math.round(s.total / days))} per day`} tone="blue" />
        <Stat label="Error rate" value={pct(s.errorRate, 2)} note="5xx responses" tone={s.errorRate > 0.01 ? 'bad' : undefined} />
        <Stat label="Latency p50" value={`${s.p50} ms`} />
        <Stat label="Latency p95" value={`${s.p95} ms`} />
      </div>
      <Panel title="Requests per day, p95 dashed"><AreaChart data={s.requests} tone="blue" overlay={{ data: s.latency, label: 'p95' }} /></Panel>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <Panel title="Status codes"><GlyphBars rows={s.status} tone="blue" value={(r) => pct(r.share, 2)} /></Panel>
        <Panel title="Routes, normalized">
          <div className="overflow-x-auto" data-lenis-prevent>
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead><tr className="hair border-b">{['Route', 'Share', 'p50', 'p95'].map((h) => <th key={h} className="label pb-3 font-normal">{h}</th>)}</tr></thead>
              <tbody>
                {s.routes.map((r) => (
                  <tr key={r.label} className="hair border-b last:border-0">
                    <td className="py-3 font-mono text-[12px]">{r.label}</td>
                    <td className="num py-3 text-mute">{pct(r.share)}</td>
                    <td className="num py-3">{r.p50} ms</td>
                    <td className={`num py-3 ${r.p95 > 400 ? 'text-bad' : ''}`}>{r.p95} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function WalletsTab({ p }: { p: Project }) {
  const s = useMemo(() => walletStats(p), [p])
  const top = s.funnel[0].value
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Signing funnel">
        <GlyphBars rows={s.funnel.map((f) => ({ label: f.label, share: f.value / top }))} value={(r) => `${fmt(Math.round(r.share * top))}  ${pct(r.share, 0)}`} />
        <p className="mt-6 text-sm text-mute">{pct(s.funnel[3].value / s.funnel[2].value, 0)} of signature requests end in a signed transaction.</p>
      </Panel>
      <Panel title="Wallet share">
        <GlyphBars rows={s.share} />
        <p className="mt-6 text-sm text-mute">Captured by @albireo/swk. Wallet id and network only, never an address.</p>
      </Panel>
    </div>
  )
}

function TrustTab({ p }: { p: Project }) {
  const [seals, setSeals] = useState<{ date: number; root: string; leaf: string }[]>([])
  useEffect(() => {
    if (!p.checks.sealed) return setSeals([])
    const dates = Array.from({ length: 7 }, (_, i) => TODAY - i * 86_400_000)
    Promise.all(dates.map((d) => prove(p.slug, d).then((pr) => ({ date: d, root: pr.root, leaf: pr.leaf })))).then(setSeals)
  }, [p])
  const score = trustScore(p)
  const checks: [string, boolean][] = [
    ['Wallet sign in, SEP-10', true],
    ['Domain in stellar.toml, SEP-1', p.checks.sep1],
    ['DNS TXT record', p.checks.dns],
    ['Origin binding enforced', p.checks.origin],
    ['Included in daily seal', p.checks.sealed],
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
      <Panel title="Trust score">
        <p className="num text-7xl leading-none text-gold">{score}</p>
        <p className="mt-3 text-sm text-mute">Out of 100. The formula is open and versioned.</p>
        <ul className="mt-6">
          {checks.map(([label, on]) => (
            <li key={label} className="hair flex items-baseline justify-between border-t py-3 text-sm"><span className={on ? '' : 'text-mute'}>{label}</span><Check on={on} /></li>
          ))}
        </ul>
        <div className="mt-6">
          <p className="label">Filtered traffic</p>
          <p className="num mt-2 text-2xl">{pct(p.botRate)}</p>
          <p className="mt-1 text-sm text-mute">Counted separately, never deleted.</p>
        </div>
      </Panel>
      <Panel title="Daily seals">
        {!p.checks.sealed && <p className="text-sm text-mute">Sealing starts once the domain is verified.</p>}
        <ul>
          {seals.map((s) => (
            <li key={s.date} className="hair grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-t py-3 font-mono text-[12px]">
              <span className="text-mute">{day(s.date)}</span>
              <span className="truncate">root <span className="text-blue">{short(s.root, 10)}</span> <span className="text-dim">leaf {short(s.leaf)}</span></span>
              <Link to={`/p/${p.slug}`} className="text-mute transition-colors hover:text-ink">verify →</Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const project = bySlug(params.get('project') ?? '') ?? PROJECTS[0]
  const [days, setDays] = useState<number>(30)
  const [tab, setTab] = useState<Tab>('Web')

  useEffect(() => { document.title = `${project.name} on Albireo` }, [project])

  return (
    <>
      <Nav />
      <DemoTabs note="demo data" />
      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <label htmlFor="project" className="label">Project</label>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <select id="project" value={project.slug} onChange={(e) => setParams({ project: e.target.value })}
                className="hair cursor-pointer appearance-none border-b bg-transparent pr-6 text-[clamp(1.8rem,4vw,2.8rem)] font-medium tracking-tight text-ink outline-none">
                {PROJECTS.map((p) => <option key={p.slug} value={p.slug} className="bg-panel text-base">{p.name}</option>)}
              </select>
              <span className="font-mono text-[12px] text-mute">{project.domain}</span>
              <span className="font-mono text-[12px] text-mute">SCF #{project.round}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div role="group" aria-label="Range" className="flex gap-4">
              {RANGES.map((r) => <button key={r} type="button" className="tab" aria-pressed={days === r} onClick={() => setDays(r)}>{r}d</button>)}
            </div>
          </div>
        </div>

        <div role="tablist" aria-label="Views" className="hair mt-10 flex gap-6 overflow-x-auto border-b pb-3">
          {TABS.map((t) => <button key={t} role="tab" type="button" className="tab shrink-0 text-[13px]" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>)}
        </div>

        <div className="mt-8" role="tabpanel" aria-label={tab}>
          {tab === 'Web' && <WebTab p={project} days={days} />}
          {tab === 'API' && <ApiTab p={project} days={days} />}
          {tab === 'Wallets' && <WalletsTab p={project} />}
          {tab === 'Trust' && <TrustTab p={project} />}
        </div>
      </main>
    </>
  )
}
