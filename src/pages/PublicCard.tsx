import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AppBar from '../components/AppBar'
import AsciiSky from '../components/AsciiSky'
import { AreaChart } from '../components/charts'
import { Check } from '../sections/Reviewers'
import { TODAY, apiStats, bySlug, day, fmt, trustScore, webStats } from '../lib/data'
import { METRICS_VERSION, prove, sha256, short, summary, verify, type Proof } from '../lib/seal'
import NotFound from './NotFound'

type Step = { label: string; detail: string; ok: boolean }

export default function PublicCard() {
  const { slug = '' } = useParams()
  const p = bySlug(slug)
  const [proof, setProof] = useState<Proof | null>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [running, setRunning] = useState(false)

  const web = useMemo(() => (p ? webStats(p, 30) : null), [p])
  const api = useMemo(() => (p ? apiStats(p, 30) : null), [p])

  useEffect(() => {
    if (!p) return
    document.title = `${p.name}, verified on Albireo`
    setSteps([])
    if (p.checks.sealed) prove(p.slug, TODAY).then(setProof)
  }, [p])

  if (!p || !web || !api) return <NotFound />

  // recompute everything a reviewer would: leaf from the published summary, proof to root, root against the ledger entry
  const run = async () => {
    if (!proof) return
    setRunning(true)
    setSteps([])
    const wait = () => new Promise((r) => setTimeout(r, 520))
    const leaf = await sha256(summary(p, TODAY))
    await wait()
    setSteps((s) => [...s, { label: 'Hash the published summary', detail: `leaf ${short(leaf, 10)}`, ok: leaf === proof.leaf }])
    const root = await verify(leaf, proof.path)
    await wait()
    setSteps((s) => [...s, { label: `Walk ${proof.path.length} sibling hashes`, detail: `root ${short(root, 10)}`, ok: true }])
    await wait()
    setSteps((s) => [...s, { label: `Read manage_data albireo:${day(TODAY)}`, detail: `ledger ${short(proof.root, 10)}`, ok: root === proof.root }])
    await wait()
    setSteps((s) => [...s, { label: 'Compare', detail: root === proof.root ? 'numbers unchanged since sealing' : 'mismatch', ok: root === proof.root }])
    setRunning(false)
  }

  return (
    <>
      <AppBar />
      <main id="main" className="relative min-h-[calc(100svh-56px)] overflow-hidden px-4 py-16 sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-50"><AsciiSky stars={false} /></div>
        <article className="hair relative mx-auto max-w-3xl border bg-space/90 backdrop-blur-sm">
          <header className="hair flex flex-wrap items-baseline justify-between gap-4 border-b p-6 sm:p-8">
            <div>
              <p className="label">Verified public card</p>
              <h1 className="mt-3 text-[clamp(2rem,5vw,3rem)] font-medium leading-none tracking-tight">{p.name}</h1>
              <p className="mt-3 whitespace-pre font-mono text-[12px] text-mute">{p.domain}  SCF #{p.round}  {p.category}</p>
            </div>
            <div className="text-right">
              <p className="label">Trust</p>
              <p className="num mt-2 text-5xl text-gold">{trustScore(p)}</p>
            </div>
          </header>

          <div className="grid gap-px bg-[rgb(236_234_228/0.1)] sm:grid-cols-2">
            <div className="bg-space p-6 sm:p-8">
              <p className="label text-gold">Visitors, 30 days</p>
              <p className="num mt-3 text-4xl">{fmt(web.total)}</p>
              <div className="mt-4"><AreaChart data={web.visitors} tone="gold" height={90} /></div>
            </div>
            <div className="bg-space p-6 sm:p-8">
              <p className="label text-blue">API requests, 30 days</p>
              {p.requests ? (
                <>
                  <p className="num mt-3 text-4xl">{fmt(api.total)}</p>
                  <div className="mt-4"><AreaChart data={api.requests} tone="blue" height={90} /></div>
                </>
              ) : <p className="mt-3 text-sm text-mute">No API connected.</p>}
            </div>
          </div>

          <div className="hair grid gap-x-8 border-t p-6 sm:grid-cols-2 sm:p-8">
            {([
              ['Wallet sign in, SEP-10', true],
              ['Domain in stellar.toml', p.checks.sep1],
              ['DNS record', p.checks.dns],
              ['Origin binding', p.checks.origin],
            ] as [string, boolean][]).map(([l, on]) => (
              <p key={l} className="hair flex items-baseline justify-between border-t py-3 text-sm"><span className={on ? '' : 'text-mute'}>{l}</span><Check on={on} /></p>
            ))}
          </div>

          <section className="hair border-t p-6 sm:p-8" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="label">Onchain proof for {day(TODAY)}</p>
                <p className="mt-2 whitespace-pre font-mono text-[12px] text-mute">{proof ? `root ${short(proof.root, 12)}` : p.checks.sealed ? 'computing' : 'not sealed yet'}  {METRICS_VERSION}</p>
              </div>
              <button type="button" onClick={run} disabled={!proof || running} className="btn btn-solid disabled:cursor-not-allowed disabled:opacity-40">
                {running ? 'Verifying' : 'Verify on Stellar'} <span className="arrow">→</span>
              </button>
            </div>
            {steps.length > 0 && (
              <ol className="mt-6 font-mono text-[12px]">
                {steps.map((s, i) => (
                  <li key={i} className="hair grid grid-cols-[1.5rem_1fr_auto] gap-3 border-t py-3 animate-[fadein_.4s_ease]">
                    <span className="text-dim">0{i + 1}</span>
                    <span>{s.label}<br /><span className="text-mute">{s.detail}</span></span>
                    <span className={s.ok ? 'text-gold' : 'text-bad'}>{s.ok ? '[ OK ]' : '[ FAIL ]'}</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-6 text-[12px] leading-relaxed text-dim">Demo data. The hashes are real SHA-256 computed in your browser; the ledger read is simulated until the anchor service is live.</p>
          </section>
        </article>
        <p className="relative mt-8 text-center"><Link to={`/demo?project=${p.slug}`} className="font-mono text-[12px] text-mute hover:text-ink">Open the full dashboard →</Link></p>
      </main>
    </>
  )
}
