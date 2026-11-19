import { useLayoutEffect, useRef, type ReactNode } from 'react'
import gsap from 'gsap'
import { Container } from '../components/Section'
import { Dim, LogStream, Ok, Terminal } from '../components/Terminal'
import { reducedMotion } from '../lib/smooth'
import { useApi, type Seal } from '../lib/api'
import { short } from '../lib/format'

const LOG = [
  ['14:02:11', '/swap', 'accept', 'NG mobile'],
  ['14:02:11', '/swap', 'drop', 'unverified site'],
  ['14:02:12', '/pools', 'drop', 'no script token'],
  ['14:02:12', '/', 'accept', 'DE desktop'],
  ['14:02:13', '/portfolio', 'drop', 'known bot'],
  ['14:02:13', '/rewards', 'accept', 'AR mobile'],
  ['14:02:14', '/', 'drop', 'rate limit'],
  ['14:02:15', '/docs', 'accept', 'US desktop'],
  ['14:02:15', '/swap', 'accept', 'PH mobile'],
  ['14:02:16', '/pools', 'drop', 'known bot'],
]

function SealTerminal() {
  const { data } = useApi<{ seals: Seal[]; account: string | null }>('/api/seals?tenant=stellarcope')
  const last = data?.seals[0]
  return (
    <Terminal title="anchor / latest seal, live">
      <Dim>$ stellarcope seal --date {last?.day ?? 'yesterday'}</Dim>{'\n'}
      leaves    {last ? `${last.leaves} project${last.leaves === 1 ? '' : 's'}, sha256` : 'loading'}{'\n'}
      root      <span className="text-blue">{last ? short(last.root, 10) : '...'}</span>{'\n'}
      op        manage_data stellarcope:{last?.day ?? ''}{'\n'}
      network   stellar testnet{'\n'}
      tx        {last?.tx_hash ? short(last.tx_hash, 10) : 'pending'} {last?.tx_hash && <Ok />}{'\n'}
      {'\n'}
      <Dim>verify it yourself on the public card</Dim>
    </Terminal>
  )
}

const STEPS: { title: string; body: string; panel: ReactNode }[] = [
  {
    title: 'Verify',
    body: 'Sign in with your Stellar wallet and prove your domain with stellar.toml, a DNS record or a meta tag. Only verified sites can send data.',
    panel: (
      <Terminal title="verifier / stellarcope.xyz">
        <Dim>$ stellarcope verify stellarcope.xyz</Dim>{'\n'}
        {'<meta name="stellarcope-verify" content="51a6...ecc8">'}{'\n'}
        {'\n'}
        meta token matches enrollment           <Ok />{'\n'}
        origin bound to stellarcope.xyz <Ok />{'\n'}
        stellar.toml ACCOUNTS check             <Dim>[ next ]</Dim>{'\n'}
        re-check scheduled  every 24h
      </Terminal>
    ),
  },
  {
    title: 'Collect',
    body: 'One pinned script for the web, a second OpenTelemetry exporter for APIs. Every event is queued before it is accepted, so an outage delays data instead of losing it.',
    panel: (
      <Terminal title="collector / ingest path">
        <span className="text-gold">{'<script defer'}</span>{'\n'}
        {'  src="https://stellarcope.xyz/v2.0.0/s.js"'}{'\n'}
        {'  integrity="sha384-Qm9yZ...2kL"'}{'\n'}
        {'  data-site="hx_7f3a"'}<span className="text-gold">{'></script>'}</span>{'\n'}
        {'\n'}
        tracker  ──▶ intake ──▶ queue ──▶ postgres{'\n'}
        <Dim>{'           202 after publish   written once'}</Dim>
      </Terminal>
    ),
  },
  {
    title: 'Filter',
    body: 'Umami bot detection, a signed token that proves the script ran, and rate limits behind a firewall. Rejected events are never stored.',
    panel: (
      <Terminal title="collector / live decisions">
        <LogStream lines={LOG} render={(l) => (
          <>
            <Dim>{l[0]}</Dim>  {l[1].padEnd(11)} {l[2] === 'accept' ? <span className="text-gold">accept</span> : <span className="text-bad">drop  </span>}  <span className="text-mute">{l[3]}</span>
          </>
        )} />
      </Terminal>
    ),
  },
  {
    title: 'Seal',
    body: 'Every night each project summary becomes a leaf in a Merkle tree, and one Stellar transaction stores the root. Anyone can check a number was not changed afterwards.',
    panel: <SealTerminal />,
  },
]

// On wide screens the four steps scroll sideways inside a pinned frame.
export default function How() {
  const root = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!root.current || !track.current || reducedMotion()) return
    const mm = gsap.matchMedia()
    mm.add('(min-width: 1024px)', () => {
      const t = track.current!
      const distance = () => t.scrollWidth - window.innerWidth
      gsap.to(t, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: { trigger: root.current, start: 'top top', end: () => `+=${distance()}`, scrub: true, pin: true, anticipatePin: 1, invalidateOnRefresh: true },
      })
    })
    return () => mm.revert()
  }, [])

  return (
    <section id="how" ref={root} className="relative overflow-hidden py-24 lg:flex lg:h-svh lg:flex-col lg:justify-center lg:py-0">
      <Container className="w-full">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <h2 className="max-w-2xl text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]">Four steps from a page view to a proof.</h2>
          </div>
        </div>
      </Container>

      <div ref={track} className="mt-14 flex flex-col gap-6 px-4 sm:px-8 lg:w-max lg:flex-row lg:gap-8">
        {STEPS.map((s) => (
          <article key={s.title} className="hair grid gap-8 border-t pt-6 lg:w-[min(78vw,1080px)] lg:grid-cols-[1fr_1.25fr] lg:border-t-0 lg:pt-0">
            <div className="flex flex-col justify-between gap-6">
              <div>
                <h3 className="text-3xl font-medium tracking-tight">{s.title}</h3>
                <p className="mt-4 max-w-md text-[15px] leading-relaxed text-mute">{s.body}</p>
              </div>
            </div>
            <div className="min-w-0 self-center">{s.panel}</div>
          </article>
        ))}
      </div>
    </section>
  )
}
