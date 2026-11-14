import { useRef, useState } from 'react'
import { Container, Eyebrow } from '../components/Section'
import { useReveal } from '../lib/reveal'

const SNIPPETS = [
  {
    id: 'html',
    label: 'HTML',
    file: 'index.html',
    code: `<script defer
  src="https://a.albireo.dev/t/1.4.2/a.js"
  integrity="sha384-Qm9yZXN0aW5nIGlzIG5vdCBhIHJlYWwgaGFzaA"
  crossorigin="anonymous"
  data-site="hx_7f3a"></script>`,
  },
  {
    id: 'npm',
    label: 'npm',
    file: 'src/main.ts',
    code: `// npm i @albireo/tracker
import { init, track } from '@albireo/tracker'

init({ site: 'hx_7f3a' })        // page views, SPA routes included
track('quote_requested', { pair: 'XLM/USDC' })`,
  },
  {
    id: 'swk',
    label: 'Wallets Kit',
    file: 'src/wallet.ts',
    code: `// npm i @albireo/swk
import { withAlbireo } from '@albireo/swk'

const kit = withAlbireo(new StellarWalletsKit(config))
// emits wallet_connected, tx_signed and friends
// with the wallet id and network, never the address`,
  },
  {
    id: 'otel',
    label: 'OpenTelemetry',
    file: 'otel-collector.yaml',
    code: `exporters:
  otlphttp/apm:        # your own APM, unchanged
    endpoint: https://otlp.your-apm.example
  otlphttp/albireo:    # the second copy for SCF
    endpoint: https://otel.albireo.dev
    headers: { authorization: "Bearer \${ALBIREO_KEY}" }

service:
  pipelines:
    traces:
      exporters: [otlphttp/apm, otlphttp/albireo]`,
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
            <Eyebrow index="06">Install</Eyebrow>
            <h2 className="mt-6 text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
              Five minutes from sign in to first event.
            </h2>
            <ol className="mt-10" data-reveal>
              {['Sign in with your Stellar wallet', 'Verify your domain', 'Paste the snippet or add the package', 'Watch the first event arrive live'].map((s, i) => (
                <li key={s} className="hair flex items-baseline gap-4 border-t py-4 text-[15px]">
                  <span className="num text-[11px] text-gold">0{i + 1}</span>{s}
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
