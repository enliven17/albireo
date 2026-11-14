import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import gsap from 'gsap'
import Nav from '../components/Nav'
import DemoTabs from '../components/DemoTabs'
import LiveFeed from '../components/LiveFeed'
import { AreaChart, Check, CountUp, GlyphBars, GlyphRing, Panel, Shimmer, Sparkline, type Tone } from '../components/viz'
import { useApi, type Point, type Seal, type Stats } from '../lib/api'
import { dur, explorerTx, fmt, ms, pct, short } from '../lib/format'
import { reducedMotion } from '../lib/smooth'

const RANGES = [7, 30, 90] as const
const TABS = ['Web', 'API', 'Wallets', 'Trust'] as const
type Tab = (typeof TABS)[number]


function Kpi({ label, value, format, series, tone = 'gold', note, noteTone }: {
  label: string; value: number | null; format?: (n: number) => string; series?: Point[]; tone?: Tone; note?: string; noteTone?: 'good' | 'bad'
}) {
  return (
    <div className="hair group relative overflow-hidden border bg-panel p-5 transition-colors duration-500 hover:bg-raise" data-panel>
      <p className="label">{label}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <CountUp value={value} format={format} className="text-[clamp(1.7rem,2.6vw,2.4rem)] leading-none text-ink" />
        {series && <div className="opacity-70 transition-opacity group-hover:opacity-100"><Sparkline data={series} tone={tone} /></div>}
      </div>
      {note && <p className={`num mt-3 text-[12px] ${noteTone === 'good' ? 'text-gold' : noteTone === 'bad' ? 'text-bad' : 'text-mute'}`}>{note}</p>}
    </div>
  )
}

/** a hairline box that slides to the active tab */
function Tabs({ value, onChange }: { value: Tab; onChange: (t: Tab) => void }) {
  const wrap = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-tab="${value}"]`)
    if (!el || !box.current) return
    gsap.to(box.current, { x: el.offsetLeft, width: el.offsetWidth, duration: reducedMotion() ? 0 : 0.45, ease: 'power3.out' })
  }, [value])
  return (
    <div ref={wrap} role="tablist" aria-label="Views" className="relative flex gap-1">
      <span ref={box} aria-hidden className="hair absolute inset-y-0 left-0 border bg-raise" />
      {TABS.map((t) => (
        <button key={t} data-tab={t} role="tab" type="button" aria-selected={value === t} onClick={() => onChange(t)}
          className={`relative px-4 py-2 font-mono text-[12px] transition-colors ${value === t ? 'text-ink' : 'text-mute hover:text-ink'}`}>{t}</button>
      ))}
    </div>
  )
}

function WebTab({ s, tenant }: { s: Stats; tenant: string }) {
  const w = s.web
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Visitors" value={w.total} series={w.visitors} note={w.delta === null ? 'no earlier period yet' : `${w.delta >= 0 ? '+' : ''}${pct(w.delta)} vs previous`} noteTone={w.delta === null ? undefined : w.delta >= 0 ? 'good' : 'bad'} />
        <Kpi label="Page views" value={w.pageviews} series={w.pageviewSeries} note={w.total ? `${(w.pageviews / w.total).toFixed(2)} per visitor` : undefined} />
        <Kpi label="Bounce rate" value={w.bounce} format={(n) => pct(n)} />
        <Kpi label="Avg visit" value={w.session} format={(n) => dur(Math.round(n))} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Visitors per day"><AreaChart data={w.visitors} tone="gold" /></Panel>
        <Panel title="Live"><LiveFeed tenant={tenant} /></Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Top pages"><GlyphBars rows={w.pages} /></Panel>
        <Panel title="Referrers"><GlyphBars rows={w.referrers} /></Panel>
        <Panel title="Countries"><GlyphBars rows={w.countries} /></Panel>
        <Panel title="Devices"><GlyphBars rows={w.devices} /></Panel>
        <Panel title="Browsers"><GlyphBars rows={w.browsers} /></Panel>
        <Panel title="Custom events"><GlyphBars rows={w.events} tone="blue" empty="No custom events tracked yet" /></Panel>
      </div>
    </div>
  )
}

function ApiTab({ s }: { s: Stats }) {
  const a = s.api
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Requests" value={a.total} series={a.requests} tone="blue" note={`${fmt(Math.round(a.total / s.days))} per day`} />
        <Kpi label="Error rate" value={a.errorRate} format={(n) => pct(n, 2)} note="5xx responses" noteTone={a.errorRate && a.errorRate > 0.01 ? 'bad' : undefined} />
        <Kpi label="Latency p50" value={a.p50} format={(n) => ms(Math.round(n))} />
        <Kpi label="Latency p95" value={a.p95} format={(n) => ms(Math.round(n))} series={a.latency} tone="ink" />
      </div>
      <Panel title="Requests per day, p95 dashed"><AreaChart data={a.requests} tone="blue" overlay={{ data: a.latency, label: 'p95', unit: ' ms' }} /></Panel>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <Panel title="Status codes"><GlyphBars rows={a.status} tone="blue" /></Panel>
        <Panel title="Routes, normalized">
          {a.routes.length ? (
            <div className="overflow-x-auto" data-lenis-prevent>
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead><tr className="hair border-b">{['Route', 'Requests', 'p50', 'p95', '5xx'].map((h) => <th key={h} className="label pb-3 font-normal">{h}</th>)}</tr></thead>
                <tbody>
                  {a.routes.map((r) => (
                    <tr key={r.label} className="hair border-b transition-colors last:border-0 hover:bg-raise">
                      <td className="py-3 pr-4 font-mono text-[12px]">{r.label}</td>
                      <td className="num py-3 pr-4 text-mute">{fmt(r.value)}</td>
                      <td className="num py-3 pr-4">{ms(r.p50)}</td>
                      <td className={`num py-3 pr-4 ${(r.p95 ?? 0) > 800 ? 'text-bad' : ''}`}>{ms(r.p95)}</td>
                      <td className={`num py-3 ${r.errors ? 'text-bad' : 'text-dim'}`}>{r.errors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="font-mono text-[12px] text-dim">No API traffic in this range yet</p>}
        </Panel>
      </div>
      <p className="font-mono text-[11px] text-dim">Albireo measures its own API with its own API analytics: every request to /api is one histogram sample here.</p>
    </div>
  )
}

function WalletsTab({ s }: { s: Stats }) {
  const top = s.wallets.funnel[0].value
  const empty = !s.wallets.funnel.some((f) => f.value)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Signing funnel">
        <GlyphBars rows={s.wallets.funnel.map((f) => ({ label: f.label, value: f.value, share: top ? f.value / top : 0 }))} value={(r) => `${fmt(r.value)}  ${pct(r.share, 0)}`} />
        {empty && <p className="mt-6 text-sm leading-relaxed text-mute">This project does not ask visitors to connect a wallet, so the funnel stays empty. Projects that wrap Stellar Wallets Kit with @albireo/swk see every step here.</p>}
      </Panel>
      <Panel title="Wallet share">
        <GlyphBars rows={s.wallets.share} empty="No wallet connections yet" />
        <p className="mt-6 text-sm text-mute">Wallet id and network only. Albireo never stores an address, a transaction or an amount.</p>
      </Panel>
    </div>
  )
}

function TrustTab({ s, tenant }: { s: Stats; tenant: string }) {
  const { data } = useApi<{ seals: Seal[]; account: string | null }>(`/api/seals?tenant=${tenant}`)
  const t = s.trust
  const checks: [string, boolean][] = [
    ['Domain in stellar.toml, SEP-1', t.checks.sep1],
    ['DNS TXT record', t.checks.dns],
    ['Meta tag on the site', t.checks.meta],
    ['Origin binding enforced', t.checks.origin],
    ['Included in a recent seal', t.checks.sealed],
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
      <Panel title="Trust score" action={<span className="font-mono text-[11px] text-dim">{t.formula}</span>}>
        <div className="flex justify-center py-2"><GlyphRing score={t.score} /></div>
        <ul className="mt-4">
          {checks.map(([label, on]) => (
            <li key={label} className="hair flex items-baseline justify-between border-t py-3 text-sm"><span className={on ? '' : 'text-mute'}>{label}</span><Check on={on} /></li>
          ))}
        </ul>
      </Panel>
      <div className="grid gap-4">
        <Panel title="Daily seals on Stellar testnet">
          {!data && <Shimmer />}
          {data && !data.seals.length && <p className="font-mono text-[12px] text-dim">The first seal is written at 00:30 UTC.</p>}
          <ul>
            {data?.seals.map((x) => (
              <li key={x.day} className="hair grid grid-cols-[6rem_1fr_auto] items-baseline gap-4 border-t py-3 font-mono text-[12px]">
                <span className="text-mute">{x.day}</span>
                <span className="truncate">root <span className="text-blue">{short(x.root, 10)}</span></span>
                {x.tx_hash ? <a href={explorerTx(x.tx_hash)} target="_blank" rel="noreferrer" className="text-mute transition-colors hover:text-ink">tx {short(x.tx_hash)} ↗</a> : <span className="text-dim">pending</span>}
              </li>
            ))}
          </ul>
          <Link to={`/p/${tenant}`} className="btn mt-5">Verify a proof yourself <span className="arrow">→</span></Link>
        </Panel>
        <Panel title="Filtered traffic" action={<span className="num text-[12px] text-mute">{pct(t.filtered)} of all hits</span>}>
          <GlyphBars rows={t.drops} tone="ink" empty="Nothing filtered in this range" />
          <p className="mt-5 text-sm text-mute">Counted separately, never deleted, never shown as visitors.</p>
        </Panel>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [params] = useSearchParams()
  const tenant = params.get('tenant') ?? 'albireo'
  const [days, setDays] = useState<number>(30)
  const [tab, setTab] = useState<Tab>('Web')
  const { data, error, loading } = useApi<Stats>(`/api/stats?tenant=${tenant}&days=${days}`, 30_000)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => { document.title = `${data?.tenant.name ?? 'Dashboard'} on Albireo` }, [data])

  // the command palette can switch tabs and ranges
  useEffect(() => {
    const on = (e: Event) => {
      const { action, value } = (e as CustomEvent<{ action: string; value: string }>).detail
      if (action === 'tab' && TABS.includes(value as Tab)) setTab(value as Tab)
      if (action === 'range') setDays(Number(value))
    }
    window.addEventListener('albireo:cmd', on)
    return () => window.removeEventListener('albireo:cmd', on)
  }, [])

  const ready = !!data
  useLayoutEffect(() => {
    if (!body.current || reducedMotion()) return
    gsap.fromTo(body.current.querySelectorAll('[data-panel]'), { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', stagger: 0.04 })
  }, [tab, ready])

  const domain = data?.trust.domains.find((d) => d.verified)?.domain

  return (
    <>
      <Nav />
      <DemoTabs note="live data" />
      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 sm:px-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[clamp(2rem,4.5vw,3.4rem)] leading-none">{data?.tenant.name ?? tenant}</h1>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-mute">
              {domain && <span>{domain}</span>}
              {data?.tenant.category && <span>{data.tenant.category}</span>}
              {data && <span><Check on={data.trust.checks.origin} /> origin bound</span>}
              {data && <span><Check on={data.trust.checks.sealed} /> sealed</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <div role="group" aria-label="Range" className="flex gap-4">
              {RANGES.map((r) => <button key={r} type="button" className="tab" aria-pressed={days === r} onClick={() => setDays(r)}>{r}d</button>)}
            </div>
            <button type="button" onClick={() => window.dispatchEvent(new Event('albireo:palette'))} className="hair border px-3 py-1.5 font-mono text-[11px] text-mute transition-colors hover:text-ink">Ctrl K</button>
          </div>
        </div>

        <div className="hair mt-8 flex flex-wrap items-center justify-between gap-4 border-b pb-3">
          <Tabs value={tab} onChange={setTab} />
          {loading && data && <span className="font-mono text-[11px] text-dim">refreshing</span>}
        </div>

        <div ref={body} className="mt-6" role="tabpanel" aria-label={tab}>
          {error && !data && <Panel title="Unavailable"><p className="text-sm text-mute">Could not load live data: {error}</p></Panel>}
          {!data && !error && <div className="grid gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="hair border bg-panel p-5"><Shimmer rows={3} /></div>)}</div>}
          {data && tab === 'Web' && <WebTab s={data} tenant={tenant} />}
          {data && tab === 'API' && <ApiTab s={data} />}
          {data && tab === 'Wallets' && <WalletsTab s={data} />}
          {data && tab === 'Trust' && <TrustTab s={data} tenant={tenant} />}
        </div>
      </main>
    </>
  )
}
