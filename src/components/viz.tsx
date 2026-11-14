import type { Point } from '../lib/api'
import { toneHex, type Tone } from './dash/core'

const path = (data: Point[], W: number, H: number, max: number) =>
  data.map((d, i) => `${i ? 'L' : 'M'}${((i / Math.max(1, data.length - 1)) * W).toFixed(1)} ${(H - (d.value / max) * (H - 4)).toFixed(1)}`).join('')

/** small trend line for tables and stat cards */
export function Sparkline({ data, tone = 'gold', width = 120, height = 32 }: { data: Point[]; tone?: Tone; width?: number; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value)) * 1.1
  const d = path(data, width, height, max)
  const c = toneHex(tone)
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="block">
      <path d={`${d}L${width} ${height}L0 ${height}Z`} fill={c} fillOpacity=".12" />
      <path d={d} fill="none" stroke={c} strokeWidth="1.25" />
    </svg>
  )
}

/** terminal style placeholder while data loads */
export function Shimmer({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => <div key={i} className="h-3 animate-pulse bg-raise" style={{ width: `${90 - i * 14}%` }} />)}
    </div>
  )
}

export { Check } from './dash/core'
