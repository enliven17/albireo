import { useEffect, useRef, useState, type ReactNode } from 'react'
import { reducedMotion } from '../lib/smooth'

export function Terminal({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={`hair border bg-panel ${className}`}>
      <div className="hair flex items-center justify-between border-b px-4 py-2.5">
        <span className="font-mono text-[11px] text-mute">{title}</span>
        <span className="font-mono text-[11px] text-dim" aria-hidden>[ ]</span>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-[1.75] text-ink" data-lenis-prevent>{children}</pre>
    </div>
  )
}

export const Ok = () => <span className="text-gold">[ OK ]</span>
export const Dim = ({ children }: { children: ReactNode }) => <span className="text-dim">{children}</span>

/** Replays a list of log lines on a loop while visible. */
export function LogStream({ lines, render, rows = 7 }: { lines: string[][]; render: (l: string[]) => ReactNode; rows?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [count, setCount] = useState(rows)

  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    let id = 0
    const io = new IntersectionObserver(([e]) => {
      clearInterval(id)
      if (e.isIntersecting) id = window.setInterval(() => setCount((c) => c + 1), 900)
    })
    io.observe(el)
    return () => { io.disconnect(); clearInterval(id) }
  }, [])

  const visible = Array.from({ length: rows }, (_, i) => lines[(count - rows + i) % lines.length])
  return <div ref={ref} aria-live="off">{visible.map((l, i) => <div key={`${count}-${i}`} className={i === rows - 1 ? 'animate-[fadein_.4s_ease]' : ''}>{render(l)}</div>)}</div>
}
