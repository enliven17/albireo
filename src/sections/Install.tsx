import { useRef, useState } from 'react'
import { Container } from '../components/Section'
import { useReveal } from '../lib/reveal'

const SNIPPETS = [
  {
    id: 'html',
    label: 'Web',
    file: 'index.html',
    code: `<script defer
  src="https://stellarcope.xyz/v2.0.0/s.js"
  integrity="sha384-..."
  crossorigin="anonymous"
  data-site="YOUR_SITE_ID"></script>`,
  },
  {
    id: 'otel',
    label: 'API',
    file: 'metrics.ts',
    code: `// keep your exporter, add a second one
new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({
    url: 'https://otlp.stellarcope.xyz/v1/metrics',
    headers: { authorization: \`Bearer \${process.env.STELLARCOPE_INGEST_KEY}\` },
  }),
})`,
  },
]

export default function Install() {
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState('html')
  const [copied, setCopied] = useState(false)
  useReveal(root)
  const snip = SNIPPETS.find((s) => s.id === active)!

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snip.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <section id="install" ref={root} className="py-32">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.5fr]">
          <div>
            <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
              Three steps to your first event.
            </h2>
            <ol className="mt-10" data-reveal>
              {['Sign in with your Stellar wallet', 'Verify your domain', 'Paste the snippet'].map((s) => (
                <li key={s} className="hair border-t py-4 text-[15px]">
                  {s}
                </li>
              ))}
            </ol>
          </div>

          <div className="hair min-w-0 border bg-panel" data-reveal>
            <div className="hair flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
              <div role="tablist" aria-label="Integration" className="flex flex-wrap gap-4">
                {SNIPPETS.map((s) => (
                  <button key={s.id} role="tab" type="button" className="tab" aria-selected={active === s.id} onClick={() => setActive(s.id)}>{s.label}</button>
                ))}
              </div>
              <button type="button" onClick={copy} className="font-mono text-[11px] text-mute transition-colors hover:text-ink">{copied ? 'copied' : 'copy'}</button>
            </div>
            <p className="px-4 pt-4 font-mono text-[11px] text-dim">{snip.file}</p>
            <pre role="tabpanel" className="overflow-x-auto p-4 pt-3 font-mono text-[12.5px] leading-[1.8] text-ink" data-lenis-prevent>{snip.code}</pre>
          </div>
        </div>
      </Container>
    </section>
  )
}
