import { MARK, cellsToPath, wordPath } from '../../brand/mark.js'

const A = cellsToPath(MARK.a)
const B = cellsToPath(MARK.b)
const WORD = wordPath('stellarcope', 20, 1, 2)
const LOCKUP_W = 20 + 65 * 2 + 1 // one unit of air so the last stroke is never clipped

export function Mark({ size = 22, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      <path d={A} fill={mono ? 'currentColor' : 'var(--color-gold)'} />
      <path d={B} fill={mono ? 'currentColor' : 'var(--color-blue)'} />
    </svg>
  )
}

/** mark and pixel wordmark, the same drawing as brand/logo/lockup-color.svg.
 * Keep size a multiple of 16 so every pixel cell lands on whole device pixels. */
export function Logo({ size = 16 }: { size?: 16 | 32 | 48 }) {
  return (
    <svg height={size} viewBox={`0 0 ${LOCKUP_W} 16`} style={{ width: (size * LOCKUP_W) / 16 }} shapeRendering="crispEdges" role="img" aria-label="Stellarcope">
      <path d={A} fill="var(--color-gold)" />
      <path d={B} fill="var(--color-blue)" />
      <path d={WORD} fill="var(--color-ink)" />
    </svg>
  )
}
