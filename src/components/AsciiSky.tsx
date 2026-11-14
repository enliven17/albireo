import { useEffect, useRef, type MutableRefObject } from 'react'
import { reducedMotion } from '../lib/smooth'

// Procedural ASCII sky, after the Eye of Creation renderer: every cell is a glyph whose ink
// coverage matches the light that lands on it. Two stars (Albireo A gold, Albireo B blue)
// start merged into one white point and drift apart as `split` goes from 0 to 1.
const RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"
const GOLD = [1.0, 0.65, 0.19]
const BLUE = [0.43, 0.61, 1.0]
const DUST = [0.62, 0.66, 0.85]
const NEBULA = [0.42, 0.3, 0.75]
const FPS = 30

type Props = {
  split?: MutableRefObject<number>
  stars?: boolean
  className?: string
  /** vertical position of the pair, 0 top to 1 bottom */
  focusY?: number
  /** horizontal travel of each star at full split, as a share of width */
  spread?: number
}

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

export default function AsciiSky({ split, stars = true, className = '', focusY = 0.42, spread = 0.2 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    const still = reducedMotion()
    let W = 0, H = 0, cols = 0, rows = 0, cw = 0, ch = 0, font = 11
    let seedA = new Float32Array(0), seedB = new Float32Array(0)
    let raf = 0, last = 0, running = true
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 }
    const styles = new Map<number, string>()

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = el.clientWidth
      H = el.clientHeight
      el.width = Math.round(W * dpr)
      el.height = Math.round(H * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      font = W < 640 ? 9 : 11
      cw = font * 0.62
      ch = font * 1.18
      cols = Math.ceil(W / cw)
      rows = Math.ceil(H / ch)
      seedA = new Float32Array(cols * rows)
      seedB = new Float32Array(cols * rows)
      for (let i = 0; i < seedA.length; i++) {
        seedA[i] = hash(i)
        seedB[i] = hash(i + 9173)
      }
      ctx.font = `${font}px "JetBrains Mono Variable", ui-monospace, monospace`
      ctx.textBaseline = 'top'
      draw(performance.now())
    }

    // one star: bright core, soft halo and four diffraction spikes
    const light = (dx: number, dy: number, size: number) => {
      const r2 = dx * dx + dy * dy
      const ax = Math.abs(dx), ay = Math.abs(dy)
      const core = Math.exp(-r2 / (0.0016 * size)) * 1.1
      const halo = 0.13 / (1 + r2 / (0.0032 * size))
      const spikes = (Math.exp(-ay / (0.003 * size)) * Math.exp(-ax / (0.12 * size))
        + Math.exp(-ax / (0.003 * size)) * Math.exp(-ay / (0.12 * size))) * 0.4
      return core + halo + spikes
    }

    const draw = (now: number) => {
      const t = still ? 0 : now / 1000
      const s = Math.min(W, H)
      const p = split ? Math.min(1, Math.max(0, split.current)) : 0
      const e = p * p * (3 - 2 * p)
      pointer.x += (pointer.tx - pointer.x) * 0.05
      pointer.y += (pointer.ty - pointer.y) * 0.05
      const ax = W * (0.5 - spread * e) + pointer.x * 14
      const ay = H * focusY + pointer.y * 10
      const bx = W * (0.5 + spread * e) + pointer.x * 22
      const by = H * focusY + H * 0.05 * e + pointer.y * 16
      const pulse = 0.93 + 0.07 * Math.sin(t * 1.4)

      ctx.clearRect(0, 0, W, H)
      let lastKey = -1
      for (let j = 0; j < rows; j++) {
        const py = (j + 0.5) * ch
        for (let i = 0; i < cols; i++) {
          const px = (i + 0.5) * cw
          const k = j * cols + i
          let A = 0, B = 0
          if (stars) {
            A = light((px - ax) / s, (py - ay) / s, 1) * pulse
            B = light((px - bx) / s, (py - by) / s, 0.62)
          }
          const h = seedA[k], h2 = seedB[k]
          const dust = h < 0.014 ? (0.2 + 0.6 * h2) * (0.55 + 0.45 * Math.sin(t * (1 + 3 * h2) + h2 * 60)) : 0
          const n = Math.sin(px * 0.0042 + t * 0.05) * Math.sin(py * 0.0061 - t * 0.04 + Math.sin(px * 0.0021))
          const neb = Math.max(0, n - 0.74) * 0.16

          const sum = A + B + dust + neb
          let L = 1 - Math.exp(-sum * 1.6)
          L = Math.pow(Math.min(1, Math.max(0, (L - 0.035) * 1.2)), 0.72)
          let idx = Math.min(RAMP.length - 1, (L * (RAMP.length - 1)) | 0)
          if (!still && idx > 1 && h2 > 0.9 && Math.sin(t * 9 + h * 40) > 0.6) idx += h > 0.5 ? 1 : -1
          if (idx < 1) continue

          // colour: weighted mix of the sources, merged stars burn white at the core
          const w = 1 / (sum + 1e-6)
          let r = (A * GOLD[0] + B * BLUE[0] + dust * DUST[0] + neb * NEBULA[0]) * w
          let g = (A * GOLD[1] + B * BLUE[1] + dust * DUST[1] + neb * NEBULA[1]) * w
          let b = (A * GOLD[2] + B * BLUE[2] + dust * DUST[2] + neb * NEBULA[2]) * w
          const white = Math.min(1, Math.max(0, (A + B - 1.4) * 0.6)) * (1 - e * 0.6)
          r += (1 - r) * white
          g += (1 - g) * white
          b += (1 - b) * white
          const ink = 0.5 + 0.65 * L
          const R = Math.min(255, r * ink * 255) >> 3
          const G = Math.min(255, g * ink * 255) >> 3
          const Bc = Math.min(255, b * ink * 255) >> 3
          const key = (R << 10) | (G << 5) | Bc
          if (key !== lastKey) {
            let style = styles.get(key)
            if (!style) {
              style = `rgb(${R << 3},${G << 3},${Bc << 3})`
              styles.set(key, style)
            }
            ctx.fillStyle = style
            lastKey = key
          }
          ctx.fillText(RAMP[idx], i * cw, j * ch)
        }
      }
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (!running || now - last < 1000 / FPS) return
      last = now
      draw(now)
    }

    const onPointer = (ev: PointerEvent) => {
      pointer.tx = (ev.clientX / window.innerWidth) * 2 - 1
      pointer.ty = (ev.clientY / window.innerHeight) * 2 - 1
    }

    const ro = new ResizeObserver(resize)
    ro.observe(el)
    const io = new IntersectionObserver(([entry]) => { running = entry.isIntersecting })
    io.observe(el)
    window.addEventListener('pointermove', onPointer, { passive: true })
    document.fonts?.ready.then(resize)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      window.removeEventListener('pointermove', onPointer)
    }
  }, [split, stars, focusY, spread])

  return <canvas ref={canvas} aria-hidden className={`block h-full w-full ${className}`} />
}
