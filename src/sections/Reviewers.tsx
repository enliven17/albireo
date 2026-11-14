import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Container, Eyebrow } from '../components/Section'
import { useReveal } from '../lib/reveal'
import { PROJECTS, fmt, trustScore } from '../lib/data'

const ROWS = [...PROJECTS].sort((a, b) => trustScore(b) - trustScore(a)).slice(0, 6)

export const Check = ({ on }: { on: boolean }) => (
  <span className={`font-mono text-[11px] ${on ? 'text-gold' : 'text-dim'}`}>{on ? '[✓]' : '[ ]'}</span>
)

export default function Reviewers() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)

  return (
    <section id="reviewers" ref={root} className="py-32">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.6fr] lg:items-end">
          <div>
            <Eyebrow index="05">For reviewers</Eyebrow>
            <h2 className="mt-6 text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
              Compare projects on the same yardstick.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-mute" data-reveal>
              The operator view lines up every enrolled project: traffic, API health, verification and trust. Filter by category or round, compare up to four side by side, and follow anomalies as they happen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3" data-reveal>
              <Link to="/operator" className="btn btn-solid">Open operator view <span className="arrow">→</span></Link>
              <Link to="/p/halcyon-dex" className="btn">See a public card</Link>
            </div>
          </div>

          <div className="hair overflow-x-auto border bg-panel" data-reveal data-lenis-prevent>
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="hair border-b">
                  {['Project', 'Category', 'Visitors / day', 'API / day', 'SEP-1', 'Sealed', 'Trust'].map((h) => (
                    <th key={h} className="label px-4 py-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((p) => (
                  <tr key={p.slug} className="hair border-b last:border-0 transition-colors hover:bg-raise">
                    <td className="px-4 py-3.5">{p.name}</td>
                    <td className="px-4 py-3.5 text-mute">{p.category}</td>
                    <td className="num px-4 py-3.5">{fmt(p.visitors)}</td>
                    <td className="num px-4 py-3.5">{p.requests ? fmt(p.requests) : <span className="text-dim">n/a</span>}</td>
                    <td className="px-4 py-3.5"><Check on={p.checks.sep1} /></td>
                    <td className="px-4 py-3.5"><Check on={p.checks.sealed} /></td>
                    <td className="num px-4 py-3.5 text-gold">{trustScore(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Container>
    </section>
  )
}
