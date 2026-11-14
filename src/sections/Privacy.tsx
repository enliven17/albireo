import { useRef } from 'react'
import { Container } from '../components/Section'
import { useReveal } from '../lib/reveal'

const KEPT = [
  'Page path, with an allowlist for query parameters',
  'Referring domain',
  'Country, derived in memory',
  'Browser, OS and device class',
  'A session hash with a rotating salt',
  'Event names and properties you define',
]
const NEVER = [
  'IP addresses',
  'Cookies, local storage or fingerprints',
  'Wallet addresses, hashes or amounts',
  'Emails, names or user IDs',
  'Request bodies, headers or query values',
  'Raw traces, spans or logs',
]

export default function Privacy() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)

  return (
    <section id="privacy" ref={root} className="py-32">
      <Container>
        <h2 className="max-w-4xl text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
          GDPR friendly without a consent banner, because there is nothing personal to consent to.
        </h2>

        <div className="mt-20 grid gap-16 md:grid-cols-2">
          {[
            { title: 'Collected', rows: KEPT, mark: '+', cls: 'text-gold' },
            { title: 'Never collected', rows: NEVER, mark: '×', cls: 'text-dim' },
          ].map((col) => (
            <div key={col.title} data-reveal>
              <p className="label">{col.title}</p>
              <ul className="mt-6">
                {col.rows.map((r) => (
                  <li key={r} className="hair flex items-baseline gap-4 border-t py-4 text-[15px]">
                    <span className={`font-mono ${col.cls}`} aria-hidden>{col.mark}</span>
                    <span className={col.title === 'Never collected' ? 'text-mute' : ''}>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-20 grid gap-10 sm:grid-cols-3" data-reveal>
          {[
            ['Residency', 'All data and backups stay in the EU, in Germany and Finland.'],
            ['Erasure', 'One action deletes a project everywhere and returns a signed receipt.'],
            ['Paperwork', 'Privacy policy and DPA templates ship with every project.'],
          ].map(([t, b]) => (
            <div key={t}>
              <p className="label">{t}</p>
              <p className="mt-3 text-sm leading-relaxed text-mute">{b}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
