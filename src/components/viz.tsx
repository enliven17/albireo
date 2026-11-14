import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import type { Point, Share } from '../lib/api'
import { fmt, pct } from '../lib/format'
import { reducedMotion } from '../lib/smooth'

export type Tone = 'gold' | 'blue' | 'ink'
const COLOR: Record<Tone, string> = { gold: 'var(--color-gold)', blue: 'var(--color-blue)', ink: 'var(--color-ink)' }

/** number that glides to its new value whenever it changes */
export function CountUp({ value, format = fmt, className = '' }: { value: number | null; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (value === null) { el.textContent = 'n/a'; return }
    if (reducedMotion()) { el.textContent = format(value); last.current = value; return }
    const obj = { v: last.current }
    const tween = gsap.to(obj, { v: value, duration: 1.1, ease: 'power3.out', onUpdate: () => { el.textContent = format(obj.v) } })
    last.current = value
    return () => { tween.kill() }
  }, [value, format])
  return <span ref={ref} className={`num ${className}`}>{value === null ? 'n/a' : format(0)}</span>
}

const path = (data: Point[], W: number, H: number, max: number) =>
  data.map((d, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, data.length - 1)) * W).toFixed(1)} ${(H - (d.value / max) * (H - 10)).toFixed(1)}`).join('')

/** area chart that draws itself in, with a gliding crosshair readout */
export function AreaChart({ data, tone = 'gold', height = 240, unit = '', overlay, empty = 'No data in this range yet' }: {
  data: Point[]; tone?: Tone; height?: number; unit?: string; overlay?: { data: Point[]; label: string; unit: string }; empty?: string
}) {
  const id = useId()
  const line = useRef<SVGPathElement>(null)
  const area = useRef<SVGPathElement>(null)
  const [hover, setHover] = useState<number | null>(null)
  const W = 1000, H = height
  const peak = Math.max(0, ...data.map((d) => d.value))
  const max = peak * 1.15 || 1
  const d = useMemo(() => path(data, W, H, max), [data, H, max])
  const oMax = overlay ? Math.max(1, ...overlay.data.map((x) => x.value)) * 1.3 : 1
  const od = overlay ? path(overlay.data, W, H, oMax) : ''

  useLayoutEffect(() => {
    if (!line.current || !area.current || reducedMotion()) return
    const len = line.current.getTotalLength()
    gsap.fromTo(line.current, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 1.4, ease: 'power3.inOut' })
    gsap.fromTo(area.current, { opacity: 0 }, { opacity: 1, duration: 1.2, delay: 0.4, ease: 'power2.out' })
  }, [d])

  const h = hover === null ? null : Math.max(0, Math.min(data.length - 1, hover))
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * W
  return (
    <div className="relative">
      <div className="mb-3 flex h-5 items-baseline justify-between gap-4 font-mono text-[11px] text-mute">
        <span>{h === null ? `${data[0]?.date ?? ''} to ${data[data.length - 1]?.date ?? ''}` : data[h].date}</span>
        <span className="text-ink">
          {h === null ? `peak ${fmt(peak)}${unit}` : `${fmt(data[h].value)}${unit}`}
          {overlay && h !== null && <span className="ml-4 text-mute">{overlay.label} {fmt(overlay.data[h].value)}{overlay.unit}</span>}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full touch-none" style={{ height }}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (data.length - 1))) }}
        onPointerLeave={() => setHover(null)} role="img" aria-label={`Daily values, peak ${fmt(peak)}${unit}`}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={COLOR[tone]} stopOpacity="0.3" />
            <stop offset="1" stopColor={COLOR[tone]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgb(236 234 228 / .06)" vectorEffect="non-scaling-stroke" />)}
        <path ref={area} d={`${d}L${W} ${H}L0 ${H}Z`} fill={`url(#${id})`} />
        <path ref={line} d={d} fill="none" stroke={COLOR[tone]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {od && <path d={od} fill="none" stroke="var(--color-ink)" strokeOpacity=".5" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {h !== null && (
          <>
            <line x1={x(h)} x2={x(h)} y1="0" y2={H} stroke="rgb(236 234 228 / .35)" vectorEffect="non-scaling-stroke" />
            <rect x={x(h) - 4} y={H - (data[h].value / max) * (H - 10) - 4} width="8" height="8" fill={COLOR[tone]} vectorEffect="non-scaling-stroke" transform-origin="center" />
          </>
        )}
      </svg>
      {peak === 0 && <p className="pointer-events-none absolute inset-x-0 top-1/2 text-center font-mono text-[12px] text-dim">{empty}</p>}
    </div>
  )
}

export function Sparkline({ data, tone = 'gold', width = 120, height = 32 }: { data: Point[]; tone?: Tone; width?: number; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.1
  const d = path(data, width, height, max)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="block">
      <path d={`${d}L${width} ${height}L0 ${height}Z`} fill={COLOR[tone]} fillOpacity=".12" />
      <path d={d} fill="none" stroke={COLOR[tone]} strokeWidth="1.25" />
    </svg>
  )
}

const BLOCKS = 24

/** ranked list drawn with block glyphs; blocks fill in from the left when the data arrives */
export function GlyphBars({ rows, tone = 'gold', value, empty = 'Nothing recorded yet' }: { rows: Share[]; tone?: Tone; value?: (r: Share) => string; empty?: string }) {
  const ref = useRef<HTMLUListElement>(null)
  const max = Math.max(0, ...rows.map((r) => r.value))
  useLayoutEffect(() => {
    if (!ref.current || reducedMotion()) return
    gsap.fromTo(ref.current.querySelectorAll('[data-fill]'), { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 0.9, ease: 'power3.out', stagger: 0.05 })
  }, [rows])
  if (!rows.length) return <p className="font-mono text-[12px] text-dim">{empty}</p>
  return (
    <ul ref={ref} className="space-y-2.5">
      {rows.map((r) => {
        const n = max ? Math.max(1, Math.round((r.value / max) * BLOCKS)) : 0
        return (
          <li key={r.label} className="group grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
            <span className="truncate text-[13px] text-ink" title={r.label}>{r.label}</span>
            <span aria-hidden className="col-span-2 row-start-2 overflow-hidden whitespace-nowrap font-mono text-[11px] leading-none sm:col-span-1 sm:row-start-auto">
              <span data-fill className="inline-block transition-opacity group-hover:opacity-80" style={{ color: COLOR[tone] }}>{'█'.repeat(n)}</span>
              <span className="text-dim">{'░'.repeat(BLOCKS - n)}</span>
            </span>
            <span className="num text-right text-[12px] text-mute">{value ? value(r) : `${fmt(r.value)}  ${pct(r.share, 0)}`}</span>
          </li>
        )
      })}
    </ul>
  )
}

/** a ring of glyphs, lit clockwise up to the score */
export function GlyphRing({ score, size = 180 }: { score: number; size?: number }) {
  const cells = 48
  const [lit, setLit] = useState(reducedMotion() ? Math.round((score / 100) * cells) : 0)
  useEffect(() => {
    if (reducedMotion()) return setLit(Math.round((score / 100) * cells))
    const obj = { v: 0 }
    const t = gsap.to(obj, { v: Math.round((score / 100) * cells), duration: 1.4, ease: 'power2.out', onUpdate: () => setLit(Math.round(obj.v)) })
    return () => { t.kill() }
  }, [score])
  const r = size / 2 - 10
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {Array.from({ length: cells }, (_, i) => {
        const a = (i / cells) * Math.PI * 2 - Math.PI / 2
        return (
          <span key={i} aria-hidden className="absolute font-mono text-[12px] leading-none"
            style={{ left: size / 2 + Math.cos(a) * r - 4, top: size / 2 + Math.sin(a) * r - 6, color: i < lit ? 'var(--color-gold)' : 'var(--color-dim)' }}>
            {i < lit ? '█' : '░'}
          </span>
        )
      })}
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="num text-5xl leading-none text-ink">{Math.round((lit / cells) * 100)}</p>
          <p className="label mt-2">trust</p>
        </div>
      </div>
    </div>
  )
}

/** terminal style placeholder while data loads */
export function Shimmer({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-3 animate-pulse bg-raise" style={{ width: `${90 - i * 14}%` }} />
      ))}
    </div>
  )
}

export function Panel({ title, action, children, className = '' }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`hair border bg-panel p-5 sm:p-6 ${className}`} data-panel>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="label !font-mono !tracking-[0.14em]">{title}</h2>
        {action}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

export const Check = ({ on }: { on: boolean }) => <span className={`font-mono text-[11px] ${on ? 'text-gold' : 'text-dim'}`}>{on ? '[✓]' : '[ ]'}</span>
