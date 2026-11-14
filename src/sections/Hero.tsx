import { useLayoutEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import AsciiSky from '../components/AsciiSky'
import { reducedMotion } from '../lib/smooth'
import { SPEC } from '../lib/site'

const SPREAD = 0.2

// Pinned opening: the pair reads as one white star, scrolling pulls it apart into
// Albireo A (gold, web) and Albireo B (blue, API).
export default function Hero() {
  const root = useRef<HTMLElement>(null)
  const split = useRef(0)

  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const place = (p: number) => {
      const e = p * p * (3 - 2 * p)
      el.style.setProperty('--ax', `${(0.5 - SPREAD * e) * 100}%`)
      el.style.setProperty('--bx', `${(0.5 + SPREAD * e) * 100}%`)
      el.style.setProperty('--by', `${(0.42 + 0.05 * e) * 100}%`)
    }
    if (reducedMotion()) {
      split.current = 1
      place(1)
      return
    }
    place(0)
    const ctx = gsap.context(() => {
      gsap.from('[data-intro]', { yPercent: 110, duration: 1.2, ease: 'power4.out', stagger: 0.08, delay: 0.15 })
      gsap.from('[data-fade]', { opacity: 0, duration: 1.4, ease: 'power2.out', delay: 0.6 })
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: el, start: 'top top', end: '+=130%', scrub: true, pin: true, anticipatePin: 1,
          onUpdate: (s) => { split.current = s.progress; place(s.progress) },
        },
      })
      tl.to('[data-copy]', { y: -60, opacity: 0, ease: 'none', duration: 0.45 }, 0)
        .fromTo('[data-split]', { opacity: 0, y: 20 }, { opacity: 1, y: 0, ease: 'none', duration: 0.35 }, 0.4)
        .fromTo('[data-star-label]', { opacity: 0 }, { opacity: 1, ease: 'none', duration: 0.3 }, 0.55)
    }, el)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} className="relative h-svh min-h-[640px] overflow-hidden" aria-labelledby="hero-title">
      <div className="absolute inset-0" data-fade>
        <AsciiSky split={split} spread={SPREAD} />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,var(--color-space)_100%)]" />
      </div>

      <div data-star-label className="pointer-events-none absolute opacity-0" style={{ left: 'calc(var(--ax) + 8vmin)', top: 'calc(42% + 8vmin)' }}>
        <p className="font-mono text-[11px] tracking-[0.14em] text-gold">[ A ] WEB</p>
      </div>
      <div data-star-label className="pointer-events-none absolute opacity-0" style={{ left: 'calc(var(--bx) + 6vmin)', top: 'calc(var(--by) + 6vmin)' }}>
        <p className="font-mono text-[11px] tracking-[0.14em] text-blue">[ B ] API</p>
      </div>

      <div data-split className="pointer-events-none absolute inset-x-0 bottom-[14%] px-4 text-center opacity-0">
        <p className="text-[clamp(1.4rem,3.2vw,2.6rem)] font-medium tracking-tight">One star to the eye. <span className="text-mute">Two lights up close.</span></p>
        <p className="mx-auto mt-3 max-w-md text-sm text-mute">Web traffic and API traffic, measured by the same platform and sealed by the same proof.</p>
      </div>

      <div data-copy className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[1440px] flex-col gap-8 px-4 pb-10 sm:px-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <h1 id="hero-title" className="text-[clamp(3rem,9vw,8.5rem)] font-medium leading-[0.92] tracking-[-0.045em]">
            <span className="block overflow-hidden pb-[0.06em]"><span data-intro className="block">Every number,</span></span>
            <span className="block overflow-hidden pb-[0.06em]"><span data-intro className="block text-mute">verified.</span></span>
          </h1>
        </div>
        <div className="max-w-md md:pb-3">
          <p className="overflow-hidden text-[15px] leading-relaxed text-mute">
            <span data-intro className="block">Albireo gives every Stellar project trusted web and API analytics. Free, cookieless, and sealed on Stellar every day, so reviewers can check what they read.</span>
          </p>
          <div className="mt-6 flex flex-wrap gap-3 overflow-hidden">
            <div data-intro className="flex flex-wrap gap-3">
              <Link to="/demo" className="btn btn-solid">Open the live demo <span className="arrow">→</span></Link>
              <a href={SPEC} target="_blank" rel="noreferrer" className="btn">Read the overview</a>
            </div>
          </div>
        </div>
      </div>

    </section>
  )
}
