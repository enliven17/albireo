import { useId, useMemo, useState } from 'react'
import { day, fmt, pct, type Point, type Share } from '../lib/data'

type Tone = 'gold' | 'blue'
const COLOR: Record<Tone, string> = { gold: 'var(--color-gold)', blue: 'var(--color-blue)' }

/** Area chart drawn in SVG, with a crosshair readout under the pointer. */
export function AreaChart({ data, tone = 'gold', height = 220, unit = '', overlay }: {
  data: Point[]
  tone?: Tone
  height?: number
  unit?: string
  overlay?: { data: Point[]; label: string }
}) {
  const id = useId()
  const [hover, setHover] = useState<number | null>(null)
  const W = 1000
  const H = height
  const max = useMemo(() => Math.max(...data.map((d) => d.value)) * 1.12 || 1, [data])
  const x = (i: number) => (i / Math.max(1, data.length - 1)) * W
  const y = (v: number, m = max) => H - (v / m) * (H - 8)
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value).toFixed(1)}`).join('')
  const oMax = overlay ? Math.max(...overlay.data.map((d) => d.value)) * 1.25 : 1
  const oLine = overlay?.data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(d.value, oMax).toFixed(1)}`).join('')

  const move = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)))
  }
  const h = hover === null ? null : Math.max(0, Math.min(data.length - 1, hover))

  return (
    <div className="relative">
      <div className="mb-3 flex h-5 items-baseline justify-between font-mono text-[11px] text-mute">
        <span>{h === null ? `${day(data[0].date)} to ${day(data[data.length - 1].date)}` : day(data[h].date)}</span>
        {h !== null && (
          <span className="text-ink">
            {fmt(data[h].value)}{unit}
            {overlay && <span className="ml-4 text-mute">{overlay.label} {overlay.data[h].value} ms</span>}
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full touch-none" style={{ height }}
        onPointerMove={move} onPointerLeave={() => setHover(null)} role="img" aria-label={`Daily values, peak ${fmt(Math.max(...data.map((d) => d.value)))}${unit}`}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={COLOR[tone]} stopOpacity="0.28" />
            <stop offset="1" stopColor={COLOR[tone]} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgb(236 234 228 / .06)" vectorEffect="non-scaling-stroke" />)}
        <path d={`${line}L${W} ${H}L0 ${H}Z`} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={COLOR[tone]} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {oLine && <path d={oLine} fill="none" stroke="var(--color-ink)" strokeOpacity=".55" strokeDasharray="4 4" strokeWidth="1" vectorEffect="non-scaling-stroke" />}
        {h !== null && <line x1={x(h)} x2={x(h)} y1="0" y2={H} stroke="rgb(236 234 228 / .35)" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  )
}

const BLOCKS = 24

/** A ranked list drawn with block glyphs, the terminal take on a bar chart. */
export function GlyphBars({ rows, tone = 'gold', value }: { rows: Share[]; tone?: Tone; value?: (r: Share) => string }) {
  const max = Math.max(...rows.map((r) => r.share))
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const n = Math.max(1, Math.round((r.share / max) * BLOCKS))
        return (
          <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 sm:grid-cols-[minmax(0,11rem)_1fr_auto]">
            <span className="truncate text-[13px] text-ink" title={r.label}>{r.label}</span>
            <span aria-hidden className="col-span-2 row-start-2 overflow-hidden whitespace-nowrap font-mono text-[11px] leading-none sm:col-span-1 sm:row-start-auto">
              <span style={{ color: COLOR[tone] }}>{'█'.repeat(n)}</span>
              <span className="text-dim">{'░'.repeat(BLOCKS - n)}</span>
            </span>
            <span className="num text-right text-[12px] text-mute">{value ? value(r) : pct(r.share)}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function Stat({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: Tone | 'bad' }) {
  const color = tone === 'bad' ? 'text-bad' : tone === 'gold' ? 'text-gold' : tone === 'blue' ? 'text-blue' : 'text-mute'
  return (
    <div className="hair border-t pt-4">
      <p className="label">{label}</p>
      <p className="num mt-3 text-[clamp(1.6rem,3vw,2.2rem)] leading-none text-ink">{value}</p>
      {note && <p className={`num mt-2 text-[12px] ${color}`}>{note}</p>}
    </div>
  )
}
