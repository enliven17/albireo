import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Nav from '../components/Nav'
import DemoTabs from '../components/DemoTabs'
import AsciiSky from '../components/AsciiSky'
import { Shimmer } from '../components/viz'
import { AnimatedNumber, Check } from '../components/dash/core'
import { DitherArea } from '../components/dash/DitherArea'
import { useApi, type Proof, type Stats } from '../lib/api'
import { explorerAccount, explorerTx, short } from '../lib/format'
import { ledgerRoot, sha256, walk } from '../lib/seal'

type Step = { label: string; detail: string; ok: boolean }

export default function PublicCard() {
  const { slug = 'stellarcope' } = useParams()
  const stats = useApi<Stats>(`/api/stats?tenant=${slug}&days=30`)
  const proof = useApi<Proof>(`/api/proof?tenant=${slug}`)
  const [steps, setSteps] = useState<Step[]>([])
  const [running, setRunning] = useState(false)
  const s = stats.data
  const p = proof.data

  useEffect(() => { document.title = `${s?.tenant.name ?? slug}, verified on Stellarcope` }, [s, slug])

  // the same checks a reviewer would run by hand, all in the browser against public data
  const run = async () => {
    if (!p) return
    setRunning(true)
    setSteps([])
    const wait = () => new Promise((r) => setTimeout(r, 450))
    const add = (x: Step) => setSteps((cur) => [...cur, x])
    const leaf = await sha256(p.summary)
    await wait()
    add({ label: 'Hash the published summary with SHA-256', detail: `leaf ${short(leaf, 10)}`, ok: leaf === p.leaf })
    const root = await walk(leaf, p.path)
    await wait()
    add({ label: `Walk ${p.path.length} sibling hashes to the root`, detail: `root ${short(root, 10)}`, ok: root === p.stored_root })
    const onChain = p.account ? await ledgerRoot(p.horizon, p.account, p.data_key).catch(() => null) : null
    await wait()
    add({ label: `Read ${p.data_key} from Horizon`, detail: onChain ? `ledger ${short(onChain, 10)}` : 'entry not found', ok: !!onChain })
    await wait()
    add({ label: 'Compare', detail: onChain === root ? 'numbers unchanged since sealing' : 'mismatch', ok: onChain === root })
    setRunning(false)
  }

  if (stats.error === 'unknown tenant') {
    return (
      <>
        <Nav />
        <DemoTabs />
        <main id="main" className="mx-auto max-w-3xl px-4 py-24 text-center"><p className="text-mute">No public card for “{slug}”.</p></main>
      </>
    )
  }

  const summary = p ? (JSON.parse(p.summary) as Record<string, number | string | null>) : null

  return (
    <>
      <Nav />
      <DemoTabs note="live data" />
      <main id="main" className="relative min-h-[calc(100svh-112px)] overflow-hidden px-4 py-16 sm:px-8">
        <div className="pointer-events-none absolute inset-0 opacity-50"><AsciiSky stars={false} /></div>
        <article className="hair relative mx-auto max-w-3xl border bg-space">
          <header className="hair flex flex-wrap items-end justify-between gap-4 border-b p-6 sm:p-8">
            <div>
              <h1 className="text-[clamp(2rem,5vw,3rem)] leading-none">{s?.tenant.name ?? slug}</h1>
              <p className="mt-3 whitespace-pre font-mono text-[12px] text-mute">{s?.trust.domains.find((d) => d.verified)?.domain ?? ''}{s?.tenant.category ? `   ${s.tenant.category}` : ''}</p>
            </div>
            <div className="text-right">
              <p className="label">Trust</p>
              <div className="mt-2"><AnimatedNumber value={s?.trust.score ?? null} className="text-5xl text-gold" /></div>
            </div>
          </header>

          <div className="grid gap-px bg-[rgb(236_234_228/0.1)] sm:grid-cols-2">
            <div className="bg-space p-6 sm:p-8">
              <p className="label text-gold">Visitors, 30 days</p>
              <div className="mt-3"><AnimatedNumber value={s?.web.total ?? null} className="text-4xl" /></div>
              <div className="mt-4">{s ? <DitherArea data={s.web.visitors} tone="gold" height={110} name="visitors" /> : <Shimmer rows={2} />}</div>
            </div>
            <div className="bg-space p-6 sm:p-8">
              <p className="label text-blue">API requests, 30 days</p>
              <div className="mt-3"><AnimatedNumber value={s?.api.total ?? null} className="text-4xl" /></div>
              <div className="mt-4">{s ? <DitherArea data={s.api.requests} tone="blue" height={110} name="requests" /> : <Shimmer rows={2} />}</div>
            </div>
          </div>

          <div className="hair grid gap-x-8 border-t p-6 sm:grid-cols-2 sm:p-8">
            {s && ([
              ['Domain in stellar.toml', s.trust.checks.sep1],
              ['DNS or meta verification', s.trust.checks.dns || s.trust.checks.meta],
              ['Origin binding', s.trust.checks.origin],
              ['Sealed recently', s.trust.checks.sealed],
            ] as [string, boolean][]).map(([l, on]) => (
              <p key={l} className="hair flex items-baseline justify-between border-t py-3 text-sm"><span className={on ? '' : 'text-mute'}>{l}</span><Check on={on} /></p>
            ))}
          </div>

          <section className="hair border-t p-6 sm:p-8" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="label">Onchain proof{p ? ` for ${p.day}` : ''}</p>
                <p className="mt-2 font-mono text-[12px] text-mute">{p ? `root ${short(p.stored_root, 12)}` : proof.error ? 'not sealed yet' : 'loading'}</p>
              </div>
              <button type="button" onClick={run} disabled={!p || running} className="btn btn-solid disabled:cursor-not-allowed disabled:opacity-40">
                {running ? 'Verifying' : 'Verify on Stellar'} <span className="arrow">→</span>
              </button>
            </div>
            {summary && (
              <pre className="hair mt-6 overflow-x-auto border bg-panel p-4 font-mono text-[12px] leading-relaxed text-mute" data-lenis-prevent>{JSON.stringify(summary, null, 2)}</pre>
            )}
            {steps.length > 0 && (
              <ol className="mt-6 font-mono text-[12px]">
                {steps.map((x, i) => (
                  <li key={i} className="hair grid grid-cols-[1fr_auto] gap-3 border-t py-3 animate-[fadein_.4s_ease]">
                    <span>{x.label}<br /><span className="text-mute">{x.detail}</span></span>
                    <span className={x.ok ? 'text-gold' : 'text-bad'}>{x.ok ? '[ OK ]' : '[ FAIL ]'}</span>
                  </li>
                ))}
              </ol>
            )}
            {p && (
              <p className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px]">
                {p.tx_hash && <a href={explorerTx(p.tx_hash)} target="_blank" rel="noreferrer" className="text-mute hover:text-ink">Transaction ↗</a>}
                {p.account && <a href={explorerAccount(p.account)} target="_blank" rel="noreferrer" className="text-mute hover:text-ink">Anchor account ↗</a>}
                <span className="text-dim">Stellar testnet</span>
              </p>
            )}
          </section>
        </article>
        <p className="relative mt-8 text-center"><Link to={`/demo?tenant=${slug}`} className="font-mono text-[12px] text-mute hover:text-ink">Open the full dashboard →</Link></p>
      </main>
    </>
  )
}
