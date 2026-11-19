import { useRef } from 'react'
import { Link } from 'react-router-dom'
import AsciiSky from '../components/AsciiSky'
import { Container } from '../components/Section'
import { useCountUp, useReveal } from '../lib/reveal'
import { REPO } from '../lib/site'

const TARGETS = [
  { value: 99.99, decimals: 2, suffix: '%', label: 'Ingestion availability target' },
  { value: 24, decimals: 0, suffix: 'h', label: 'Critical patch window' },
  { value: 99.9, decimals: 2, suffix: '%', label: 'Dashboard availability target' },
  { value: 0, decimals: 0, suffix: '', label: 'Fees, for every project' },
]

export default function Open() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)
  useCountUp(root)

  return (
    <>
      <section ref={root} className="py-32">
        <Container>
          <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
            <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
              Built in the open. Handed over by design.
            </h2>
            <p className="max-w-lg text-[15px] leading-relaxed text-mute" data-reveal>
              MIT licensed, infrastructure included. During the twelve-month service window, Stellarcope passes to a community-appointed operator with its data, domain and anchor account.
            </p>
          </div>
          <dl className="mt-20 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {TARGETS.map((t) => (
              <div key={t.label} className="hair border-t pt-5" data-reveal>
                <dd className="num text-5xl"><span data-count={t.value} data-decimals={t.decimals}>{t.value.toFixed(t.decimals)}</span><span className="text-mute">{t.suffix}</span></dd>
                <dt className="label mt-4">{t.label}</dt>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section className="relative overflow-hidden py-40" aria-labelledby="cta-title">
        <div className="absolute inset-0 opacity-70"><AsciiSky stars={false} /></div>
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,var(--color-space)_85%)]" />
        <Container className="relative text-center">
          <h2 id="cta-title" className="mx-auto max-w-4xl text-[clamp(2.6rem,7vw,6rem)] font-medium leading-[0.95] tracking-[-0.045em]">
            Measure it here. <span className="text-mute">Prove it on Stellar.</span>
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/demo" className="btn btn-solid">Open the live demo <span className="arrow">→</span></Link>
            <a href={REPO} target="_blank" rel="noreferrer" className="btn">Star on GitHub</a>
          </div>
        </Container>
      </section>
    </>
  )
}
