import { useEffect, useRef, useState } from 'react'
import { hash, rgba, smoothstep, toneHex, useCanvasSetup, type Tone } from './core'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * Hour by weekday heatmap after the cankatui ActivityHeatmap: each cell is filled with
 * dithered pixels whose density follows the traffic in that hour.
 */
export function DitherHeatmap({ grid, tone = 'gold' }: { grid: number[][]; tone?: Tone }) {
  const { canvasRef, rect, isVisible, reducedMotion } = useCanvasSetup()
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null)
  const data = useRef(grid)
  const from = useRef(grid)
  const start = useRef(0)
  const max = Math.max(1, ...grid.flat())
  const maxRef = useRef(max)

  useEffect(() => {
    from.current = data.current
    data.current = grid
    maxRef.current = Math.max(1, ...grid.flat())
    start.current = performance.now()
  }, [grid])

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
      t += reducedMotion ? 0 : 0.02
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const p = reducedMotion ? 1 : Math.min(1, (performance.now() - start.current) / 600)
      const e = 1 - Math.pow(2, -10 * p)
      const gap = 3
      const cw = (w - gap * 23) / 24
      const ch = (h - gap * 6) / 7
      const px = 2
      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      for (let d = 0; d < 7; d++) {
        for (let hr = 0; hr < 24; hr++) {
          const v0 = from.current[d]?.[hr] ?? 0
          const v1 = data.current[d]?.[hr] ?? 0
          const v = (v0 + (v1 - v0) * e) / maxRef.current
          const x = hr * (cw + gap)
          const y = d * (ch + gap)
          ctx.fillStyle = 'rgba(236,234,228,0.04)'
          ctx.fillRect(x, y, cw, ch)
          if (v <= 0) continue
          ctx.fillStyle = rgba(color, 0.35 + 0.65 * v)
          for (let tx = x; tx < x + cw; tx += px + 1) {
            for (let ty = y; ty < y + ch; ty += px + 1) {
              const wave = reducedMotion ? 0.5 : smoothstep(-1.5, 1.5, Math.sin(tx * 0.05 + t) + Math.sin(ty * 0.05 + t * 0.7))
              if (hash(tx, ty) > v * 0.9 + 0.1 + wave * 0.08) continue
              ctx.fillRect(tx, ty, px, px)
            }
          }
        }
      }
      ctx.restore()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [tone, reducedMotion, canvasRef, rect, isVisible])

  return (
    <div>
      <div className="flex gap-3">
        <div className="flex h-[168px] shrink-0 flex-col justify-around font-mono text-[10px] leading-none text-dim">{DAYS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="relative min-w-0 flex-1">
          <canvas ref={canvasRef} className="block h-[168px] w-full"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setHover({ d: Math.min(6, Math.floor(((e.clientY - r.top) / r.height) * 7)), h: Math.min(23, Math.floor(((e.clientX - r.left) / r.width) * 24)) })
            }}
            onPointerLeave={() => setHover(null)} aria-label="Page views by hour and weekday" role="img" />
          <div className="mt-2 flex justify-between font-mono text-[10px] text-dim"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
        </div>
      </div>
      <p className="mt-3 h-4 font-mono text-[11px] text-mute">
        {hover ? `${DAYS[hover.d]} ${String(hover.h).padStart(2, '0')}:00 UTC, ${grid[hover.d]?.[hover.h] ?? 0} page views` : `busiest hour holds ${max === 1 && !grid.flat().some(Boolean) ? 0 : max} page views`}
      </p>
    </div>
  )
}

/** a strip of daily cells after the cankatui UptimeChart; lit cells are good days */
export function DitherCells({ days, tone = 'gold', label }: { days: { date: string; state: 0 | 1 | 2 }[]; tone?: Tone; label: (d: { date: string; state: 0 | 1 | 2 }) => string }) {
  const { canvasRef, rect, isVisible, reducedMotion } = useCanvasSetup()
  const [hover, setHover] = useState<number | null>(null)
  const ref = useRef(days)
  ref.current = days

  useEffect(() => {
    let raf = 0
    let t = 0
    let last = 0
    const color = toneHex(tone)
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw)
      if (!isVisible.current || now - last < 33) return
      last = now
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      const { width: w, height: h } = rect.current
      if (!canvas || !ctx || !w || !h) return
      t += reducedMotion ? 0 : 0.02
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const n = ref.current.length
      const gap = 3
      const bw = (w - gap * (n - 1)) / n
      ctx.save()
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.scale(dpr, dpr)
      ref.current.forEach((d, i) => {
        const x = i * (bw + gap)
        ctx.fillStyle = d.state === 2 ? rgba(color, 0.9) : d.state === 1 ? rgba(color, 0.45) : 'rgba(236,234,228,0.12)'
        for (let tx = x; tx < x + bw; tx += 2) {
          for (let ty = 0; ty < h; ty += 2) {
            const mod = reducedMotion ? 0.5 : smoothstep(-1.5, 1.5, Math.sin(tx * 0.05 + t) + Math.sin(ty * 0.05 + t * 0.7))
            const sz = 2 * (0.45 + 0.4 * mod) * (0.8 + 0.4 * hash(tx, ty))
            ctx.fillRect(tx + (2 - sz) / 2, ty + (2 - sz) / 2, sz, sz)
          }
        }
      })
      ctx.restore()
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [tone, reducedMotion, canvasRef, rect, isVisible])

  return (
    <div>
      <canvas ref={canvasRef} className="block h-10 w-full" role="img" aria-label="Daily status"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.min(days.length - 1, Math.floor(((e.clientX - r.left) / r.width) * days.length))) }}
        onPointerLeave={() => setHover(null)} />
      <div className="mt-2 flex justify-between font-mono text-[10px] text-dim">
        <span>{days[0]?.date}</span>
        <span className="text-mute">{hover !== null ? label(days[hover]) : ''}</span>
        <span>{days[days.length - 1]?.date}</span>
      </div>
    </div>
  )
}
