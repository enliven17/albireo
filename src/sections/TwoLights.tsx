import { useRef } from 'react'
import { Container } from '../components/Section'
import { AnimatedNumber } from '../components/dash/core'
import { DitherArea } from '../components/dash/DitherArea'
import { useReveal } from '../lib/reveal'
import { useApi, type Stats } from '../lib/api'

const SIDES = [
  {
    tone: 'gold' as const,
    star: 'Gold star',
    title: 'Web analytics',
    body: 'Cookieless page analytics built on Umami. Works with static sites, single-page apps and SSR frameworks.',
    metrics: ['Page views and visitors', 'Referrers', 'Session duration and bounce rate', 'Country, device and browser'],
    figure: 'visitors, 30 days',
    pick: (x: Stats) => ({ value: x.web.total, data: x.web.visitors }),
  },
  {
    tone: 'blue' as const,
    star: 'Blue star',
    title: 'API analytics',
    body: 'Add a second OpenTelemetry exporter next to your APM. Only metrics are kept; traces, spans and logs are dropped.',
    metrics: ['Requests per route', 'Status codes', 'Latency p50 and p95', '24 months of hourly history'],
    figure: 'requests, 30 days',
    pick: (x: Stats) => ({ value: x.api.total, data: x.api.requests }),
  },
]

export default function TwoLights() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)
  const { data } = useApi<Stats>('/api/stats?tenant=stellarcope&days=30')

  return (
    <section ref={root} className="py-32">
      <Container>
        <h2 className="max-w-3xl text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
          The whole project in one view. <span className="text-mute">Front door and back end.</span>
        </h2>

        <div className="mt-20 grid gap-px bg-[rgb(236_234_228/0.1)] lg:grid-cols-2">
          {SIDES.map((s) => {
            const live = data ? s.pick(data) : null
            return (
            <article key={s.star} className="bg-space p-0 pb-12 lg:p-10 lg:first:pl-0 lg:last:pr-0" data-reveal>
              <h3 className={`text-3xl font-medium tracking-tight ${s.tone === 'gold' ? 'text-gold' : 'text-blue'}`}>{s.title}</h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">{s.body}</p>

              <div className="mt-10 flex items-baseline gap-3">
                <AnimatedNumber value={live?.value ?? null} className="text-5xl" />
                <span className="label">{s.figure}</span>
              </div>
              <div className="mt-6">{live ? <DitherArea data={live.data} tone={s.tone} height={150} name={s.tone === 'gold' ? 'visitors' : 'requests'} /> : <div className="h-[174px]" />}</div>

              <ul className="mt-10 grid gap-x-8 sm:grid-cols-2">
                {s.metrics.map((m) => (
                  <li key={m} className="hair border-t py-3 text-sm">
                    {m}
                  </li>
                ))}
              </ul>
            </article>
            )
          })}
        </div>
        <p className="label mt-6 text-dim">Live: Stellarcope measuring its own site and API</p>
      </Container>
    </section>
  )
}
