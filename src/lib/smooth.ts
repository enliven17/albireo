import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

let lenis: Lenis | null = null
export const getLenis = () => lenis

// One Lenis instance drives the window and feeds GSAP's ticker, so ScrollTrigger
// reads the smoothed position. Reduced motion keeps native scrolling.
export function useSmoothScroll() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (reducedMotion()) return
    lenis = new Lenis({ lerp: 0.075, wheelMultiplier: 0.9 })
    lenis.on('scroll', ScrollTrigger.update)
    const raf = (t: number) => lenis?.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(raf)
      lenis?.destroy()
      lenis = null
    }
  }, [])

  useEffect(() => {
    if (hash) return
    lenis?.scrollTo(0, { immediate: true, force: true })
    window.scrollTo(0, 0)
    requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [pathname, hash])
}

export function scrollToId(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset: -72, duration: 1.4 })
  else el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' })
}
