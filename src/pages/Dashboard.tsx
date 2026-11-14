import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import Nav from '../components/Nav'
import DemoTabs from '../components/DemoTabs'
import { Sparkline } from '../components/viz'
import { AnimatedNumber, AnimatedTabs, Card, CardHead, Check } from '../components/dash/core'
import { DitherArea } from '../components/dash/DitherArea'
import { DitherDonut } from '../components/dash/DitherDonut'
import { DitherCells, DitherHeatmap } from '../components/dash/DitherGrid'
import { Funnel, LiveStream, RankList } from '../components/dash/lists'
import { useApi, type Point, type Seal, type Stats } from '../lib/api'
import { dur, explorerTx, ms, pct, short } from '../lib/format'

const RANGES = ['7d', '30d', '90d'] as const
const VIEWS = ['Web', 'API', 'Wallets', 'Trust'] as const
type View = (typeof VIEWS)[number]

function Kpi({ label, value, format, note, tone, series, sparkTone = 'gold' }: {
  label: string; value: number | null; format?: (n: number) => string; note?: string; tone?: 'good' | 'bad'; series?: Point[]; sparkTone?: 'gold' | 'blue' | 'ink'
}) {
  return (
    <Card className="p-5">
      <CardHead title={label} />
      <div className="mt-4 flex items-end justify-between gap-3">
        <AnimatedNumber value={value} format={format} className="text-[clamp(1.8rem,2.6vw,2.4rem)] leading-none" />
        {series && <Sparkline data={series} tone={sparkTone} width={96} height={28} />}
      </div>
      {note && <p className={`mt-3 font-mono text-[11px] ${tone === 'good' ? 'text-gold' : tone === 'bad' ? 'text-bad' : 'text-dim'}`}>{note}</p>}
    </Card>
  )
}

function WebView({ s, tenant }: { s: Stats; tenant: string }) {
  const w = s.web
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-8">
        <CardHead title="Visitors" meta={
          <div className="flex items-baseline gap-3">
            <AnimatedNumber value={w.total} className="text-[clamp(2.4rem,4vw,3.6rem)] leading-none" />
            <span className={`font-mono text-[12px] ${w.delta === null ? 'text-dim' : w.delta >= 0 ? 'text-gold' : 'text-bad'}`}>
              {w.delta === null ? 'first period' : `${w.delta >= 0 ? '+' : ''}${pct(w.delta)} vs previous`}
            </span>
          </div>
        } />
        <div className="mt-6"><DitherArea data={w.visitors} tone="gold" height={250} name="visitors" /></div>
      </Card>
      <div className="grid gap-4 lg:col-span-4">
        <Kpi label="Page views" value={w.pageviews} series={w.pageviewSeries} note={w.total ? `${(w.pageviews / w.total).toFixed(2)} per visitor` : 'no visits yet'} />
        <Kpi label="Bounce rate" value={w.bounce} format={(n) => pct(n)} note="single page visits" />
        <Kpi label="Average visit" value={w.session} format={(n) => dur(Math.round(n))} note="first to last event of a visit" />
      </div>

      <Card className="p-6 lg:col-span-7">
        <CardHead title="When people visit" meta={<span className="font-mono text-[11px] text-dim">page views by hour, UTC</span>} />
        <div className="mt-6"><DitherHeatmap grid={w.heatmap ?? []} /></div>
      </Card>
      <Card className="p-6 lg:col-span-5"><LiveStream tenant={tenant} /></Card>

      <Card className="p-6 lg:col-span-4">
        <CardHead title="Devices" />
        <div className="mt-6"><DitherDonut slices={w.devices} center={{ value: w.total, label: 'visitors' }} /></div>
      </Card>
      <Card className="p-6 lg:col-span-4">
        <CardHead title="Browsers" />
        <div className="mt-6"><DitherDonut slices={w.browsers} tone="ink" center={{ value: w.browsers.length, label: 'families' }} /></div>
      </Card>
      <Card className="p-6 lg:col-span-4">
        <CardHead title="Countries" />
        <div className="mt-6"><RankList rows={w.countries} /></div>
      </Card>

      <Card className="p-6 lg:col-span-6">
        <CardHead title="Top pages" />
        <div className="mt-6"><RankList rows={w.pages} limit={8} /></div>
      </Card>
      <Card className="p-6 lg:col-span-6">
        <CardHead title="Referrers" />
        <div className="mt-6"><RankList rows={w.referrers} tone="ink" limit={8} /></div>
      </Card>
      <Card className="p-6 lg:col-span-12">
        <CardHead title="Custom events" meta={<span className="font-mono text-[11px] text-dim">window.albireo.track(name, props)</span>} />
        <div className="mt-6"><RankList rows={w.events} tone="blue" empty="No custom events tracked yet" /></div>
      </Card>
    </div>
  )
}

function ApiView({ s }: { s: Stats }) {
  const a = s.api
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-8" glow="rgba(110,155,255,0.09)">
        <CardHead title="Requests" meta={<AnimatedNumber value={a.total} className="text-[clamp(2.4rem,4vw,3.6rem)] leading-none" />} />
        <div className="mt-6"><DitherArea data={a.requests} tone="blue" height={250} name="requests" overlay={{ data: a.latency, unit: ' ms', name: 'p95' }} /></div>
        <p className="mt-3 font-mono text-[11px] text-dim">dashed pixels trace daily p95 latency</p>
      </Card>
      <div className="grid gap-4 lg:col-span-4">
        <Kpi label="Error rate" value={a.errorRate} format={(n) => pct(n, 2)} note="5xx responses" tone={a.errorRate && a.errorRate > 0.01 ? 'bad' : undefined} />
        <Kpi label="Latency p50" value={a.p50} format={(n) => ms(Math.round(n))} note="median response" />
        <Kpi label="Latency p95" value={a.p95} format={(n) => ms(Math.round(n))} series={a.latency} sparkTone="ink" note="slowest 5% start here" />
      </div>

      <Card className="p-6 lg:col-span-5" glow="rgba(110,155,255,0.09)">
        <CardHead title="Status codes" />
        <div className="mt-6"><DitherDonut slices={a.status} tone="blue" center={{ value: a.total, label: 'requests' }} /></div>
      </Card>
      <Card className="p-6 lg:col-span-7" glow="rgba(110,155,255,0.09)">
        <CardHead title="Routes" meta={<span className="font-mono text-[11px] text-dim">normalized, Stellar ids folded</span>} />
        {a.routes.length ? (
          <div className="mt-5 overflow-x-auto" data-lenis-prevent>
            <table className="w-full min-w-[520px] text-left text-[13px]">
              <thead><tr className="hair border-b">{['Route', 'Requests', 'p50', 'p95', '5xx'].map((h) => <th key={h} className="pb-3 pr-4 font-mono text-[11px] font-normal text-dim">{h}</th>)}</tr></thead>
              <tbody>
                {a.routes.map((r, i) => (
                  <motion.tr key={r.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className="hair border-b transition-colors last:border-0 hover:bg-raise">
                    <td className="py-3 pr-4 font-mono text-[12px] text-ink">{r.label}</td>
                    <td className="num py-3 pr-4 text-mute">{r.value.toLocaleString('en-US')}</td>
                    <td className="num py-3 pr-4">{ms(r.p50)}</td>
                    <td className={`num py-3 pr-4 ${(r.p95 ?? 0) > 800 ? 'text-bad' : ''}`}>{ms(r.p95)}</td>
                    <td className={`num py-3 ${r.errors ? 'text-bad' : 'text-dim'}`}>{r.errors}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-6 font-mono text-[12px] text-dim">No API traffic in this range yet</p>}
      </Card>
      <p className="font-mono text-[11px] text-dim lg:col-span-12">Albireo measures its own API with its own API analytics. Every request to /api is one histogram sample on this page.</p>
    </div>
  )
}

function WalletsView({ s }: { s: Stats }) {
  const empty = !s.wallets.funnel.some((f) => f.value)
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-7" glow="rgba(110,155,255,0.09)">
        <CardHead title="Signing funnel" meta={<span className="font-mono text-[11px] text-dim">@albireo/swk</span>} />
        <div className="mt-6"><Funnel steps={s.wallets.funnel} /></div>
        {empty && <p className="mt-6 text-[13px] leading-relaxed text-mute">This project does not ask visitors to connect a wallet, so the funnel stays empty. Projects that wrap Stellar Wallets Kit see every step here.</p>}
      </Card>
      <Card className="p-6 lg:col-span-5">
        <CardHead title="Wallet share" />
        <div className="mt-6"><DitherDonut slices={s.wallets.share} center={{ value: s.wallets.funnel[1]?.value ?? 0, label: 'connections' }} /></div>
        <p className="mt-6 text-[13px] text-mute">Wallet id and network only. Never an address, a transaction or an amount.</p>
      </Card>
    </div>
  )
}

function TrustView({ s, tenant }: { s: Stats; tenant: string }) {
  const { data } = useApi<{ seals: Seal[] }>(`/api/seals?tenant=${tenant}`)
  const t = s.trust
  const byDay = new Map((data?.seals ?? []).map((x) => [x.day, x]))
  const strip = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - (29 - i + 1) * 86_400_000).toISOString().slice(0, 10)
    const seal = byDay.get(date)
    return { date, state: (seal?.tx_hash ? 2 : seal ? 1 : 0) as 0 | 1 | 2 }
  })
  const checks: [string, boolean][] = [
    ['stellar.toml lists the account (SEP-1)', t.checks.sep1],
    ['DNS TXT record', t.checks.dns],
    ['Meta tag on the site', t.checks.meta],
    ['Origin binding enforced', t.checks.origin],
    ['Included in a recent seal', t.checks.sealed],
  ]
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-5">
        <CardHead title="Trust score" meta={<span className="font-mono text-[11px] text-dim">{t.formula}</span>} />
        <div className="mt-6"><DitherDonut slices={[{ label: 'score', value: t.score }, { label: 'missing', value: 100 - t.score }]} center={{ value: t.score, label: 'of 100' }} /></div>
        <ul className="mt-6">
          {checks.map(([l, on]) => <li key={l} className="hair flex items-baseline justify-between gap-4 border-t py-3 text-[13px]"><span className={on ? '' : 'text-mute'}>{l}</span><Check on={on} /></li>)}
        </ul>
      </Card>
      <div className="grid gap-4 lg:col-span-7">
        <Card className="p-6">
          <CardHead title="Daily seals, last 30 days" meta={<span className="font-mono text-[11px] text-dim">bright: anchored on Stellar testnet</span>} />
          <div className="mt-6"><DitherCells days={strip} label={(d) => `${d.date} ${d.state === 2 ? 'anchored' : d.state === 1 ? 'sealed, not anchored' : 'no seal'}`} /></div>
          <ul className="mt-5">
            {data?.seals.slice(0, 5).map((x) => (
              <li key={x.day} className="hair grid grid-cols-[6rem_1fr_auto] items-baseline gap-4 border-t py-3 font-mono text-[12px]">
                <span className="text-mute">{x.day}</span>
                <span className="truncate">root <span className="text-blue">{short(x.root, 10)}</span></span>
                {x.tx_hash ? <a href={explorerTx(x.tx_hash)} target="_blank" rel="noreferrer" className="text-mute transition-colors hover:text-ink">tx ↗</a> : <span className="text-dim">pending</span>}
              </li>
            ))}
          </ul>
          <Link to={`/p/${tenant}`} className="btn mt-5">Verify a proof yourself <span className="arrow">→</span></Link>
        </Card>
        <Card className="p-6">
          <CardHead title="Filtered traffic" meta={<span className="font-mono text-[11px] text-dim">{pct(t.filtered)} of all hits, counted never shown</span>} />
          <div className="mt-6"><DitherDonut slices={t.drops} tone="ink" center={{ value: t.drops.reduce((a, d) => a + d.value, 0), label: 'dropped' }} /></div>
        </Card>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [params] = useSearchParams()
  const tenant = params.get('tenant') ?? 'albireo'
  const [range, setRange] = useState<(typeof RANGES)[number]>('30d')
  const [view, setView] = useState<View>('Web')
  const days = Number(range.replace('d', ''))
  const { data, error, loading } = useApi<Stats>(`/api/stats?tenant=${tenant}&days=${days}`, 30_000)

  useEffect(() => { document.title = `${data?.tenant.name ?? 'Dashboard'} on Albireo` }, [data])
  useEffect(() => {
    const on = (e: Event) => {
      const { action, value } = (e as CustomEvent<{ action: string; value: string }>).detail
      if (action === 'tab' && VIEWS.includes(value as View)) setView(value as View)
      if (action === 'range' && RANGES.includes(`${value}d` as (typeof RANGES)[number])) setRange(`${value}d` as (typeof RANGES)[number])
    }
    window.addEventListener('albireo:cmd', on)
    return () => window.removeEventListener('albireo:cmd', on)
  }, [])

  const domain = data?.trust.domains.find((d) => d.verified)?.domain

  return (
    <>
      <Nav />
      <DemoTabs note={loading && data ? 'refreshing' : 'live data'} />
      <main id="main" className="mx-auto max-w-[1440px] px-4 pb-24 pt-10 sm:px-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[clamp(2.2rem,5vw,3.8rem)] leading-none">{data?.tenant.name ?? tenant}</h1>
            <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] text-mute">
              {domain && <span className="text-ink">{domain}</span>}
              {data && <span><Check on={data.trust.checks.origin} /> origin bound</span>}
              {data && <span><Check on={data.trust.checks.sealed} /> sealed on Stellar</span>}
              {data && <span>trust {data.trust.score}</span>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AnimatedTabs tabs={RANGES} value={range} onChange={setRange} label="Range" size="sm" />
            <button type="button" onClick={() => window.dispatchEvent(new Event('albireo:palette'))} className="hair border px-3 py-[7px] font-mono text-[11px] text-mute transition-colors hover:text-ink">Ctrl K</button>
          </div>
        </motion.div>

        <div className="mt-8"><AnimatedTabs tabs={VIEWS} value={view} onChange={setView} label="Views" /></div>

        <div className="mt-6">
          {error && !data && <Card className="p-6"><p className="text-sm text-mute">Could not load live data: {error}</p></Card>}
          {!data && !error && (
            <div className="grid gap-4 lg:grid-cols-12">
              {[8, 4, 7, 5].map((span, i) => <div key={i} className="hair h-64 animate-pulse border bg-panel" style={{ gridColumn: `span ${span} / span ${span}` }} />)}
            </div>
          )}
          <AnimatePresence mode="wait">
            {data && (
              <motion.div key={view} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                {view === 'Web' && <WebView s={data} tenant={tenant} />}
                {view === 'API' && <ApiView s={data} />}
                {view === 'Wallets' && <WalletsView s={data} />}
                {view === 'Trust' && <TrustView s={data} tenant={tenant} />}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </>
  )
}
