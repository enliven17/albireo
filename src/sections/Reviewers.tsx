import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { Container } from '../components/Section'
import { Check, Shimmer, Sparkline } from '../components/viz'
import { useReveal } from '../lib/reveal'
import { useApi, type Project } from '../lib/api'
import { fmt } from '../lib/format'

export default function Reviewers() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)
  const { data } = useApi<{ projects: Project[] }>('/api/projects?days=30')

  return (
    <section id="reviewers" ref={root} className="py-32">
      <Container>
        <div className="grid gap-14 lg:grid-cols-[1fr_1.6fr] lg:items-end">
          <div>
            <h2 className="text-[clamp(2.2rem,5vw,4.2rem)] font-medium leading-[1] tracking-[-0.035em]" data-reveal>
              Compare projects on the same yardstick.
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-mute" data-reveal>
              The operator view lines up every enrolled project: traffic, API health, verification and trust. The table on the right is live.
            </p>
            <div className="mt-8 flex flex-wrap gap-3" data-reveal>
              <Link to="/operator" className="btn btn-solid">Open operator view <span className="arrow">→</span></Link>
              <Link to="/p/stellarcope" className="btn">See a public card</Link>
            </div>
          </div>

          <div className="hair overflow-x-auto border bg-panel" data-reveal data-lenis-prevent>
            {!data && <div className="p-6"><Shimmer rows={3} /></div>}
            {data && (
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="hair border-b">
                    {['Project', 'Visitors, 30d', 'API, 30d', 'Trend', 'Verified', 'Sealed', 'Trust'].map((h) => <th key={h} className="label px-4 py-3 font-normal">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.projects.map((p) => (
                    <tr key={p.id} className="hair border-b transition-colors last:border-0 hover:bg-raise">
                      <td className="px-4 py-3.5">{p.name}</td>
                      <td className="num px-4 py-3.5">{fmt(p.visitors)}</td>
                      <td className="num px-4 py-3.5">{fmt(p.requests)}</td>
                      <td className="px-4 py-3.5"><Sparkline data={p.visitorSeries} width={80} height={22} /></td>
                      <td className="px-4 py-3.5"><Check on={p.checks.origin} /></td>
                      <td className="px-4 py-3.5"><Check on={p.checks.sealed} /></td>
                      <td className="num px-4 py-3.5 text-gold">{p.trust}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Container>
    </section>
  )
}
