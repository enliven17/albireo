import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { useApi, type Live } from '../lib/api'
import { ago } from '../lib/format'
import { reducedMotion } from '../lib/smooth'

const SPIN = ['|', '/', '-', '\\']

/** polls the live endpoint; new rows slide in at the top */
export default function LiveFeed({ tenant }: { tenant: string }) {
  const { data } = useApi<Live>(`/api/live?tenant=${tenant}`, 5000)
  const list = useRef<HTMLOListElement>(null)
  const seen = useRef(new Set<string>())
  const [frame, setFrame] = useState(0)
  const [, tick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => { setFrame((f) => (f + 1) % SPIN.length); tick((t) => t + 1) }, 1000)
    return () => clearInterval(id)
  }, [])

  useLayoutEffect(() => {
    if (!data || !list.current) return
    const fresh = [...list.current.querySelectorAll<HTMLElement>('[data-key]')].filter((el) => !seen.current.has(el.dataset.key!))
    if (seen.current.size && fresh.length && !reducedMotion()) gsap.from(fresh, { opacity: 0, x: -12, duration: 0.6, ease: 'power3.out', stagger: 0.05 })
    for (const e of data.events) seen.current.add(e.ts + e.path)
  }, [data])

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-[12px]"><span className="text-gold">[ {SPIN[frame]} ]</span> <span className="text-ink">{data?.active ?? 0}</span> <span className="text-mute">visitors in the last 5 minutes</span></p>
      </div>
      <ol ref={list} className="mt-4 max-h-[360px] overflow-y-auto font-mono text-[12px]" data-lenis-prevent>
        {!data?.events.length && <li className="text-dim">Waiting for the first event.</li>}
        {data?.events.map((e) => (
          <li key={e.ts + e.path} data-key={e.ts + e.path} className="hair grid grid-cols-[4.5rem_1fr_auto] gap-3 border-t py-2.5">
            <span className="text-dim">{ago(e.ts)}</span>
            <span className="truncate">{e.type === 'event' ? <span className="text-blue">{e.name}</span> : e.path}</span>
            <span className="text-mute">{e.country ?? '--'} {e.device}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
