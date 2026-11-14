import { useEffect, useId, useRef, useState, type ReactNode, type RefObject, type MutableRefObject } from 'react'
import { LayoutGroup, motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'

// Ported from the cankatui registry: the canvas performance hook, spring numbers,
// layout animated tabs and the spotlight card, restyled for Albireo (square, gold and blue).

export const GOLD = '#FFA630'
export const BLUE = '#6E9BFF'
export const INK = '#ECEAE4'
export type Tone = 'gold' | 'blue' | 'ink'
export const toneHex = (t: Tone) => (t === 'gold' ? GOLD : t === 'blue' ? BLUE : INK)

export const smoothstep = (a: number, b: number, v: number) => {
  const x = Math.max(0, Math.min(1, (v - a) / (b - a)))
  return x * x * (3 - 2 * x)
}
export const hash = (x: number, y: number) => {
  const h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453
  return h - Math.floor(h)
}
export const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`

/** caches canvas size, pauses off screen and in hidden tabs, reads reduced motion once */
export function useCanvasSetup(): { canvasRef: RefObject<HTMLCanvasElement>; rect: MutableRefObject<{ width: number; height: number }>; isVisible: MutableRefObject<boolean>; reducedMotion: boolean } {
  const canvasRef = useRef<HTMLCanvasElement>(null!)
  const rect = useRef({ width: 0, height: 0 })
  const isVisible = useRef(true)
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      rect.current = { width, height }
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    })
    ro.observe(canvas)
    const io = new IntersectionObserver(([e]) => { isVisible.current = e.isIntersecting }, { rootMargin: '100px' })
    io.observe(canvas)
    const vis = () => { isVisible.current = document.visibilityState === 'visible' }
    document.addEventListener('visibilitychange', vis)
    return () => { ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis) }
  }, [])

  return { canvasRef, rect, isVisible, reducedMotion }
}

/** spring driven number; formats on every frame */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString('en-US'), className = '' }: { value: number | null; format?: (n: number) => string; className?: string }) {
  const reduce = useReducedMotion()
  const spring = useSpring(0, { stiffness: 190, damping: 27, mass: 0.7 })
  const display = useTransform(spring, (v) => format(v))
  useEffect(() => {
    if (value === null) return
    if (reduce) spring.jump(value)
    else spring.set(value)
  }, [value, spring, reduce])
  if (value === null) return <span className={`num ${className}`}>n/a</span>
  return <motion.span className={`num tabular-nums ${className}`}>{display}</motion.span>
}

/** tabs whose active frame glides between triggers with a shared layout id */
export function AnimatedTabs<T extends string>({ tabs, value, onChange, label, size = 'md' }: { tabs: readonly T[]; value: T; onChange: (v: T) => void; label: string; size?: 'sm' | 'md' }) {
  const id = useId()
  const reduce = useReducedMotion()
  return (
    <LayoutGroup id={id}>
      <div role="tablist" aria-label={label} className="hair inline-flex border p-1">
        {tabs.map((t) => (
          <button key={t} role="tab" type="button" aria-selected={value === t} onClick={() => onChange(t)}
            className={`relative font-mono transition-colors ${size === 'sm' ? 'px-3 py-1 text-[11px]' : 'px-4 py-1.5 text-[12px]'} ${value === t ? 'text-space' : 'text-mute hover:text-ink'}`}>
            {value === t && (
              <motion.span layoutId={`${id}-active`} aria-hidden className="absolute inset-0 bg-ink"
                transition={reduce ? { duration: 0.12 } : { type: 'spring', bounce: 0, duration: 0.35 }} />
            )}
            <span className="relative">{t}</span>
          </button>
        ))}
      </div>
    </LayoutGroup>
  )
}

/** card with a soft light that follows the pointer */
export function Card({ children, className = '', glow = 'rgba(236,234,228,0.07)', ...rest }: { children: ReactNode; className?: string; glow?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const x = useMotionValue(-400)
  const y = useMotionValue(-400)
  const bg = useMotionTemplate`radial-gradient(320px circle at ${x}px ${y}px, ${glow}, transparent 70%)`
  return (
    <motion.div {...(rest as object)}
      onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); x.set(e.clientX - r.left); y.set(e.clientY - r.top) }}
      onMouseLeave={() => { x.set(-400); y.set(-400) }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`hair group relative overflow-hidden border bg-panel ${className}`}>
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 transition-opacity duration-300" style={{ background: bg }} />
      <div className="relative h-full">{children}</div>
    </motion.div>
  )
}

export function CardHead({ title, meta, children }: { title: string; meta?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="!font-sans text-[13px] !tracking-normal text-mute">{title}</h3>
        {meta && <div className="mt-1">{meta}</div>}
      </div>
      {children}
    </div>
  )
}

export const Check = ({ on }: { on: boolean }) => <span className={`font-mono text-[11px] ${on ? 'text-gold' : 'text-dim'}`}>{on ? '[✓]' : '[ ]'}</span>
