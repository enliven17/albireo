import { useRef } from 'react'
import { Container, Eyebrow } from '../components/Section'
import { AreaChart } from '../components/charts'
import { useCountUp, useReveal } from '../lib/reveal'
import { PROJECTS, apiStats, webStats } from '../lib/data'

const halcyon = PROJECTS[0]
const web = webStats(halcyon, 30)
const api = apiStats(halcyon, 30)

const SIDES = [
  {
    tone: 'gold' as const,
    star: 'Albireo A',
    title: 'Web analytics',
    body: 'Cookieless page analytics on an Umami core. Works with static HTML, single page apps and server rendered frameworks.',
    metrics: ['Page views and unique visitors', 'Referrers and campaigns', 'Session duration and bounce rate', 'Country, device and browser', 'Custom events', 'Stellar Wallets Kit funnel'],
    figure: { value: web.total, label: 'visitors, 30 days' },
    data: web.visitors,
  },
  {
    tone: 'blue' as const,
    star: 'Albireo B',
    title: 'API analytics',
    body: 'Projects dual export OpenTelemetry: one stream to their own APM, one to Albireo. Traces and logs are dropped at the door, only counters and histograms are kept.',
    metrics: ['Request volume per route', 'Status code distribution', 'Latency p50 and p95', 'Stellar aware route names', 'Secret key redaction', '24 months of rollups'],
    figure: { value: api.total, label: 'requests, 30 days' },
    data: api.requests,
  },
]

export default function TwoLights() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)
  useCountUp(root)

  return (
    <section ref={root} className="py-32">
      <Container>
        <Eyebrow index="02">Two lights</Eyebrow>
        <h2 className="mt-6 max-w-3xl text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
          The whole project in one view. <span className="text-mute">Front door and back end.</span>
        </h2>

        <div className="mt-20 grid gap-px bg-[rgb(236_234_228/0.1)] lg:grid-cols-2">
          {SIDES.map((s) => (
            <article key={s.star} className="bg-space p-0 pb-12 lg:p-10 lg:first:pl-0 lg:last:pr-0" data-reveal>
              <p className={`font-mono text-[11px] tracking-[0.14em] ${s.tone === 'gold' ? 'text-gold' : 'text-blue'}`}>{s.star.toUpperCase()}</p>
              <h3 className="mt-4 text-3xl font-medium tracking-tight">{s.title}</h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">{s.body}</p>

              <div className="mt-10 flex items-baseline gap-3">
                <span className="num text-5xl" data-count={s.figure.value}>{s.figure.value.toLocaleString('en-US')}</span>
                <span className="label">{s.figure.label}</span>
              </div>
              <div className="mt-6"><AreaChart data={s.data} tone={s.tone} height={150} /></div>

              <ul className="mt-10 grid gap-x-8 sm:grid-cols-2">
                {s.metrics.map((m, i) => (
                  <li key={m} className="hair flex items-baseline gap-3 border-t py-3 text-sm">
                    <span className="num text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>{m}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="label mt-6 text-dim">Demo data from a sample project</p>
      </Container>
    </section>
  )
}
