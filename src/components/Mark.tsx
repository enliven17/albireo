import { MARK, cellsToPath, wordPath } from '../../brand/mark.js'

const A = cellsToPath(MARK.a)
const B = cellsToPath(MARK.b)
const WORD = wordPath('albireo', 20, 1, 2)
const LOCKUP_W = 20 + 41 * 2

export function Mark({ size = 22, mono = false }: { size?: number; mono?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path d={A} fill={mono ? 'currentColor' : 'var(--color-gold)'} />
      <path d={B} fill={mono ? 'currentColor' : 'var(--color-blue)'} />
    </svg>
  )
}

/** mark and pixel wordmark, the same drawing as brand/logo/lockup-color.svg */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg height={size} viewBox={`0 0 ${LOCKUP_W} 16`} style={{ width: (size * LOCKUP_W) / 16 }} role="img" aria-label="Albireo">
      <path d={A} fill="var(--color-gold)" />
      <path d={B} fill="var(--color-blue)" />
      <path d={WORD} fill="var(--color-ink)" />
    </svg>
  )
}
