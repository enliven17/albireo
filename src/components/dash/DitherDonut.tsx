import { useEffect, useRef, useState } from 'react'
import { AnimatedNumber, hash, rgba, smoothstep, toneHex, useCanvasSetup, type Tone } from './core'

export type Slice = { label: string; value: number }

// shades step from the tone toward the dim ink, so slices read in brightness order
const shade = (tone: Tone, i: number, n: number) => {
  const base = toneHex(tone)
  const k = n <= 1 ? 1 : 1 - (i / (n - 1)) * 0.75
  return rgba(base, k)
}

/**
 * Dithered donut after the cankatui DitherDonutChart: pixel cells fill each slice, shimmer,
 * morph between datasets, and the hovered slice lifts out. A legend row drives the hover.
 */
export function DitherDonut({ slices, tone = 'gold', center, size = 168 }: { slices: Slice[]; tone?: Tone; center?: { value: number | null; label: string; format?: (n: number) => string }; size?: number }) {
  const { canvasRef, rect, isVisible, reducedMotion } = useCanvasSetup()
  const [hover, setHover] = useState<number | null>(null)
  const hoverRef = useRef<number | null>(null)
  hoverRef.current = hover
  const total = slices.reduce((a, s) => a + s.value, 0)
  const shares = slices.map((s) => (total ? s.value / total : 0))
  const disp = useRef<number[]>([])
  const from = useRef<number[]>([])
  const target = useRef<number[]>([])
  const start = useRef(0)
  const colors = useRef<string[]>([])
  colors.current = slices.map((_, i) => shade(tone, i, slices.length))

  useEffect(() => {
    from.current = shares.map((_, i) => disp.current[i] ?? 0)
    target.current = shares
    start.current = performance.now()
  }, [total, slices.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let raf = 0
    let t = 0
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (!isVisible.current) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      const { width: w, height: h } = rect.current
      if (!canvas || !ctx || !w || !h) return
      t += reducedMotion ? 0 : 0.02
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const L = 200
      const p = reducedMotion ? 1 : Math.min(1, (performance.now() - start.current) / 600)
      const e = 1 - Math.pow(2, -10 * p)
      disp.current = target.current.map((v, i) => (from.current[i] ?? 0) + (v - (from.current[i] ?? 0)) * e)

      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale((w * dpr) / L, (h * dpr) / L)
      const rIn = 58, rOut = 88, cell = 4.6
      // empty ring when nothing is recorded
      if (!disp.current.some((s) => s > 0.001)) {
        ctx.fillStyle = 'rgba(236,234,228,0.08)'
        for (let x = 10; x <= 190; x += cell) for (let y = 10; y <= 190; y += cell) {
          const d = Math.hypot(x - 100, y - 100)
          if (d > rIn && d < rOut) ctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4)
        }
      }
      let a0 = -Math.PI / 2
      const gap = disp.current.filter((s) => s > 0.001).length > 1 ? 0.06 : 0
      disp.current.forEach((share, i) => {
        if (share <= 0.001) return
        const sweep = share * Math.PI * 2
        const aStart = a0 + gap / 2
        const aEnd = a0 + sweep - gap / 2
        a0 += sweep
        const hovered = hoverRef.current === i
        const dim = hoverRef.current !== null && !hovered
        const mid = (aStart + aEnd) / 2
        const ox = hovered ? Math.cos(mid) * 5 : 0
        const oy = hovered ? Math.sin(mid) * 5 : 0
        ctx.fillStyle = colors.current[i]
        ctx.globalAlpha = dim ? 0.25 : hovered ? 1 : 0.85
        for (let x = 10; x <= 190; x += cell) {
          for (let y = 10; y <= 190; y += cell) {
            const dx = x - 100, dy = y - 100
            const d = Math.hypot(dx, dy)
            if (d < rIn || d > rOut) continue
            let a = Math.atan2(dy, dx) - aStart
            while (a < 0) a += Math.PI * 2
            if (a > aEnd - aStart) continue
            const full = smoothstep(0.5, 1, (d - rIn) / (rOut - rIn))
            const wave = reducedMotion ? 0.5 : smoothstep(-1.5, 1.5, Math.sin(d * 0.1 - t) + Math.sin(Math.atan2(dy, dx) * 3 + t * 1.5))
            const sz = cell * ((hovered ? 0.5 : 0.36) + 0.32 * full + 0.22 * wave) * (0.8 + 0.4 * hash(x, y))
            ctx.fillRect(x + ox - sz / 2, y + oy - sz / 2, sz, sz)
          }
        }
      })
      ctx.globalAlpha = 1
      ctx.restore()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion, canvasRef, rect, isVisible])

  const hovered = hover !== null ? slices[hover] : null
  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <canvas ref={canvasRef} className="block h-full w-full" />
        {center && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div>
              {hovered
                ? <><p className="num text-xl text-ink">{total ? Math.round((hovered.value / total) * 100) : 0}%</p><p className="mt-1 max-w-[80px] truncate font-mono text-[10px] text-mute">{hovered.label}</p></>
                : <><AnimatedNumber value={center.value} format={center.format} className="text-xl text-ink" /><p className="mt-1 font-mono text-[10px] text-mute">{center.label}</p></>}
            </div>
          </div>
        )}
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {slices.length === 0 && <li className="font-mono text-[12px] text-dim">Nothing recorded yet</li>}
        {slices.map((s, i) => (
          <li key={s.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            className={`flex cursor-default items-center justify-between gap-3 border px-2.5 py-1.5 transition-colors ${hover === i ? 'hair bg-raise' : 'border-transparent'}`}>
            <span className="flex min-w-0 items-center gap-2.5">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0" style={{ background: colors.current[i] }} />
              <span className="truncate text-[13px]">{s.label}</span>
            </span>
            <span className="flex shrink-0 gap-3 font-mono text-[12px]">
              <span className="text-ink">{s.value.toLocaleString('en-US')}</span>
              <span className="w-9 text-right text-dim">{total ? Math.round((s.value / total) * 100) : 0}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
