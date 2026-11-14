import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from './smooth'

const NOISE = '░▒▓#%&@*+=:.'

// Decodes text left to right like a terminal the first time it scrolls into view.
export function useScramble<T extends HTMLElement>(text: string, ms = 1200) {
  const ref = useRef<T>(null)
  const [out, setOut] = useState(text)

  useEffect(() => {
    const el = ref.current
    if (!el || reducedMotion()) return
    const width = Math.max(...text.split('\n').map((l) => l.length))
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      const start = performance.now()
      let last = 0
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / ms)
        if (now - last > 40 || p === 1) {
          last = now
          let col = 0
          let s = ''
          for (const c of text) {
            if (c === '\n') { s += c; col = 0; continue }
            s += c === ' ' || col / width < p * 1.25 - 0.25 ? c : NOISE[(Math.random() * NOISE.length) | 0]
            col++
          }
          setOut(p === 1 ? text : s)
        }
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.3 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [text, ms])

  return [ref, out] as const
}
