import { useEffect, useRef, useState } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { clampNum, fmtTick } from './util'
import { hash, rgba, smoothstep, toneHex, useCanvasSetup, type Tone } from './core'

export type Series = { date: string; value: number }[]

const label = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })

/**
 * Dithered area chart after the cankatui DitherGrowthChart: pixel cells fill under the curve,
 * shimmer slowly, brighten around the pointer and morph when the series changes.
 */
export function DitherArea({ data, tone = 'gold', height = 220, unit = '', name = 'value', overlay }: {
  data: Series; tone?: Tone; height?: number; unit?: string; name?: string; overlay?: { data: Series; unit: string; name: string }
}) {
  const { canvasRef, rect, isVisible, reducedMotion } = useCanvasSetup()
  const wrap = useRef<HTMLDivElement>(null)
  const [scrub, setScrub] = useState<number | null>(null)
  const tx = useSpring(0, { stiffness: 650, damping: 42, mass: 0.5 })
  const ty = useSpring(0, { stiffness: 650, damping: 42, mass: 0.5 })
  const left = useTransform(tx, (v) => `${v}px`)
  const top = useTransform(ty, (v) => `${v}px`)

  const values = data.map((d) => d.value)
  const max = Math.max(1, ...values)
  const empty = values.every((v) => v === 0)

  const from = useRef<number[]>(values)
  const target = useRef<number[]>(values)
  const fromMax = useRef(max)
  const targetMax = useRef(max)
  const start = useRef(0)
  const pointer = useRef({ x: -999, y: -999, on: false })
  const overlayRef = useRef<number[]>([])
  overlayRef.current = overlay?.data.map((d) => d.value) ?? []

  useEffect(() => {
    const prev = target.current
    from.current = values.map((_, i) => prev[Math.round((i / Math.max(1, values.length - 1)) * (prev.length - 1))] ?? 0)
    fromMax.current = targetMax.current
    target.current = values
    targetMax.current = max
    start.current = performance.now()
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let raf = 0
    let t = 0
    const color = toneHex(tone)
    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (!isVisible.current) return
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      const { width: w, height: h } = rect.current
      if (!canvas || !ctx || !w || !h) return
      t += reducedMotion ? 0 : 0.03
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cell = Math.max(3, Math.round(w / 170))
      const p = reducedMotion ? 1 : Math.min(1, (performance.now() - start.current) / 520)
      const e = 1 - Math.pow(1 - p, 3)
      const cur = target.current.map((v, i) => (from.current[i] ?? 0) + (v - (from.current[i] ?? 0)) * e)
      const curMax = fromMax.current + (targetMax.current - fromMax.current) * e
      const plot = h * 0.84
      const { x: px, y: py, on } = pointer.current

      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      for (let x = 0; x < w; x += cell) {
        const exact = (x / w) * (cur.length - 1)
        const i0 = Math.floor(exact)
        const i1 = Math.min(i0 + 1, cur.length - 1)
        const v = (cur[i0] ?? 0) + ((cur[i1] ?? 0) - (cur[i0] ?? 0)) * (exact - i0)
        const curve = h - plot * (v / curMax)
        for (let y = h; y >= 0; y -= cell) {
          ctx.fillStyle = 'rgba(236,234,228,0.035)'
          ctx.fillRect(x + 1, y + 1, cell - 1, cell - 1)
          if (y < curve) continue
          const glow = on && !reducedMotion ? 1 - smoothstep(0, h * 0.4, Math.hypot(x - px, y - py)) : 0
          const shimmer = reducedMotion ? 0 : Math.sin(y * 0.1 - t * 2 + x * 0.02) * 0.08
          const depth = 1 - smoothstep(curve, h, y) * 0.55
          const sz = cell * (0.62 + shimmer + glow * 0.3) * (0.85 + 0.3 * hash(x, y))
          ctx.fillStyle = rgba(color, Math.min(1, (0.45 + glow * 0.5) * depth + 0.15))
          const o = (cell - sz) / 2
          ctx.fillRect(x + o, y + o, sz, sz)
        }
      }
      // optional overlay drawn as a stepped pixel line on its own scale
      const ov = overlayRef.current
      if (ov.length) {
        const om = Math.max(1, ...ov) * 1.25
        ctx.fillStyle = 'rgba(236,234,228,0.75)'
        for (let x = 0; x < w; x += cell) {
          const exact = (x / w) * (ov.length - 1)
          const i0 = Math.floor(exact)
          const i1 = Math.min(i0 + 1, ov.length - 1)
          const v = ov[i0] + (ov[i1] - ov[i0]) * (exact - i0)
          if (!v) continue
          const y = h - plot * (v / om)
          if ((x / cell) % 2 === 0) ctx.fillRect(x, Math.round(y / cell) * cell, cell - 1, Math.max(2, cell / 2))
        }
      }
      ctx.restore()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [tone, reducedMotion, canvasRef, rect, isVisible])

  const move = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect()
    const x = e.clientX - r.left
    pointer.current = { x, y: e.clientY - r.top, on: true }
    const idx = Math.round(clampNum(x / r.width, 0, 1) * (data.length - 1))
    setScrub(idx)
    tx.set((data.length > 1 ? idx / (data.length - 1) : 0.5) * r.width)
    ty.set(r.height - r.height * 0.84 * (data[idx].value / max))
  }

  const ticks = max >= 2 ? [max, max * 0.5, 0] : [max, 0]
  const dates = [0, Math.floor(data.length / 2), data.length - 1].map((i) => data[i]?.date).filter(Boolean)

  return (
    <div className="flex gap-3">
      <div className="relative w-9 shrink-0" style={{ height }}>
        {ticks.map((v, i) => (
          <span key={i} className="absolute right-0 -translate-y-1/2 font-mono text-[10px] text-dim" style={{ top: `${16 + (i / (ticks.length - 1)) * 84}%` }}>{fmtTick(v)}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div ref={wrap} className="relative cursor-crosshair touch-none overflow-hidden" style={{ height }}
          onPointerMove={move} onPointerLeave={() => { pointer.current.on = false; setScrub(null) }}
          role="img" aria-label={`${name} per day, peak ${fmtTick(max)}${unit}`}>
          <canvas ref={canvasRef} className="block h-full w-full" />
          {empty && <p className="pointer-events-none absolute inset-0 grid place-items-center font-mono text-[12px] text-dim">No {name} in this range yet</p>}
          {scrub !== null && (
            <>
              <motion.div className="pointer-events-none absolute bottom-0 top-0 z-10 w-px" style={{ left, background: rgba(toneHex(tone), 0.8) }} />
              <motion.div className="pointer-events-none absolute z-20 -ml-[5px] -mt-[5px] h-[10px] w-[10px] border-2 border-space" style={{ left, top, background: toneHex(tone) }} />
              <motion.div className="hair pointer-events-none absolute z-30 mb-3 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap border bg-space px-2.5 py-1.5" style={{ left, top }}>
                <div className="font-mono text-[10px] text-mute">{label(data[scrub].date)}</div>
                <div className="font-mono text-[12px] text-ink">{data[scrub].value.toLocaleString('en-US')}{unit} {name}</div>
                {overlay && <div className="font-mono text-[11px] text-mute">{overlay.data[scrub]?.value ?? 0}{overlay.unit} {overlay.name}</div>}
              </motion.div>
            </>
          )}
        </div>
        <div className="mt-2 flex justify-between font-mono text-[10px] text-dim">{dates.map((d) => <span key={d}>{label(d!)}</span>)}</div>
      </div>
    </div>
  )
}
