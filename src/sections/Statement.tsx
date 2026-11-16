import { useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { Container } from '../components/Section'
import { reducedMotion } from '../lib/smooth'
import { useCountUp, useReveal } from '../lib/reveal'

const TEXT = 'Grant reviews still start with a screenshot. Stellarcope replaces it with a number anyone can check.'

// The statement lights up word by word as it is read.
export default function Statement() {
  const root = useRef<HTMLElement>(null)
  useReveal(root)
  useCountUp(root)

  useLayoutEffect(() => {
    if (!root.current || reducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('[data-word]', { opacity: 0.14 }, {
        opacity: 1, ease: 'none', stagger: 0.05,
        scrollTrigger: { trigger: '[data-statement]', start: 'top 80%', end: 'bottom 45%', scrub: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  return (
    <section ref={root} className="py-32 md:py-48">
      <Container>
        <p data-statement className="max-w-4xl text-[clamp(1.7rem,4.2vw,3.6rem)] font-medium leading-[1.12] tracking-[-0.03em]">
          {TEXT.split(' ').map((w, i) => <span key={i} data-word className="inline-block whitespace-pre">{w} </span>)}
        </p>

        <dl className="mt-24 grid gap-10 sm:grid-cols-3">
          {[
            { n: 0, label: 'Cookies set', note: 'Nothing is stored on the visitor device.' },
            { n: 0, label: 'Personal data kept', note: 'No IP addresses, no wallet addresses, no user IDs.' },
            { n: 1, label: 'Seal per day', note: 'One Stellar transaction proves every project summary.' },
          ].map((s) => (
            <div key={s.label} className="hair border-t pt-5" data-reveal>
              <dt className="label">{s.label}</dt>
              <dd className="num mt-4 text-6xl text-ink" data-count={s.n}>{s.n}</dd>
              <dd className="mt-3 max-w-xs text-sm text-mute">{s.note}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </section>
  )
}
