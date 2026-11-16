import { useRef } from 'react'
import { Container } from '../components/Section'
import { useReveal } from '../lib/reveal'

const FEATURES = [
  { tag: 'SEP-10 / SEP-1', title: 'Stellar native enrollment', body: 'Projects sign in with a wallet and prove their domain through stellar.toml, DNS or a meta tag. Fake tenants have nothing to sign with.' },
  { tag: 'Merkle / manage_data', title: 'Sealed on chain, daily', body: 'One transaction a day stores the root of every project summary. Inclusion proofs let anyone confirm a number was never edited after the fact.' },
  { tag: 'Origin / ASN / rate', title: 'Inflation resistant', body: 'Events from unverified origins are refused. Crawlers, datacenter traffic, headless browsers and bursts are filtered and counted in the open.' },
  { tag: 'Score 0 to 100', title: 'Open trust score', body: 'Verification, filtered share, anomaly history and data continuity become one score. The formula is versioned in the repository.' },
  { tag: 'G / C / M / S', title: 'Stellar aware API routes', body: 'Accounts, contracts, muxed IDs, assets and hashes collapse into readable route names. A secret seed in a URL is never written and the team is warned.' },
  { tag: 'No addresses', title: 'Wallets Kit funnel', body: 'Modal opens, connections and signatures per wallet, across the ecosystem. Wallet addresses, hashes and amounts are never collected.' },
]

export default function Trust() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)

  return (
    <section id="trust" ref={root} className="py-32">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
              Built for the reviewer who has to believe it.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-mute" data-reveal>
              Analytics tools count. Stellarcope also proves where the count came from, what was thrown away and that nobody touched it later.
            </p>
          </div>

          <div className="grid gap-px bg-[rgb(236_234_228/0.1)] sm:grid-cols-2">
            {FEATURES.map((f) => (
              <article key={f.title} className="group relative bg-space p-7 transition-colors duration-500 hover:bg-panel" data-reveal>
                <span className="font-mono text-[11px] text-mute transition-colors group-hover:text-gold">{f.tag}</span>
                <h3 className="mt-14 text-xl font-medium tracking-tight">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-mute">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
