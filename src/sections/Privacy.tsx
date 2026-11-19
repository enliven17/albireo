import { useRef } from 'react'
import { Container } from '../components/Section'
import { useReveal } from '../lib/reveal'

const KEPT = [
  'Page path, without the query string',
  'Referrer',
  'Country, browser, OS and device type',
  'A session hash whose salt rotates daily',
]
const NEVER = [
  'IP addresses',
  'Cookies or anything stored on the device',
  'Visitor wallet addresses',
  'Traces, spans and logs',
]

export default function Privacy() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)

  return (
    <section id="privacy" ref={root} className="py-32">
      <Container>
        <h2 className="max-w-4xl text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
          Nothing personal is stored. <span className="text-mute">Visitors cannot be linked across days.</span>
        </h2>

        <div className="mt-20 grid gap-16 md:grid-cols-2">
          {[
            { title: 'Stored', rows: KEPT, mark: '+', cls: 'text-gold' },
            { title: 'Never stored', rows: NEVER, mark: '×', cls: 'text-dim' },
          ].map((col) => (
            <div key={col.title} data-reveal>
              <p className="label">{col.title}</p>
              <ul className="mt-6">
                {col.rows.map((r) => (
                  <li key={r} className="hair flex items-baseline gap-4 border-t py-4 text-[15px]">
                    <span className={`font-mono ${col.cls}`} aria-hidden>{col.mark}</span>
                    <span className={col.title === 'Never stored' ? 'text-mute' : ''}>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="label mt-16 text-dim" data-reveal>All data stays in the EU: AWS Frankfurt, with a standby in Ireland.</p>
      </Container>
    </section>
  )
}
