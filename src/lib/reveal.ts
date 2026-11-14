import { useLayoutEffect, type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { reducedMotion } from './smooth'

// Children marked data-reveal rise in as they enter, in reading order.
export function useReveal(root: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    if (!root.current || reducedMotion()) return
    const ctx = gsap.context(() => {
      const items = gsap.utils.toArray<HTMLElement>('[data-reveal]')
      gsap.set(items, { y: 28, opacity: 0 })
      ScrollTrigger.batch(items, {
        start: 'top 88%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { y: 0, opacity: 1, duration: 0.9, ease: 'power3.out', stagger: 0.08 }),
      })
    }, root)
    return () => ctx.revert()
  }, [root])
}

/** counts a number up the first time it scrolls into view */
export function useCountUp(root: RefObject<HTMLElement>) {
  useLayoutEffect(() => {
    if (!root.current || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
        const end = Number(el.dataset.count)
        const decimals = Number(el.dataset.decimals ?? 0)
        const obj = { v: 0 }
        gsap.to(obj, {
          v: end,
          duration: 1.6,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          onUpdate: () => { el.textContent = obj.v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) },
        })
      })
    }, root)
    return () => ctx.revert()
  }, [root])
}
