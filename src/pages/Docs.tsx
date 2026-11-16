import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import gsap from 'gsap'
import Nav from '../components/Nav'
import Footer from '../components/Footer'
import { PAGES } from '../docs/pages'
import { getLenis, reducedMotion } from '../lib/smooth'
import { REPO } from '../lib/site'

const GROUPS = [...new Set(PAGES.map((p) => p.group))]

function Sidebar({ query, onQuery, onPick }: { query: string; onQuery: (q: string) => void; onPick?: () => void }) {
  const list = PAGES.filter((p) => `${p.title} ${p.lead} ${p.group}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <nav aria-label="Docs">
      <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Search docs" aria-label="Search docs"
        className="hair w-full border bg-transparent px-3 py-2 font-mono text-[12px] text-ink outline-none placeholder:text-dim focus:border-[rgb(236_234_228/.4)]" />
      <div className="mt-6 space-y-7">
        {GROUPS.map((g) => {
          const items = list.filter((p) => p.group === g)
          if (!items.length) return null
          return (
            <div key={g}>
              <p className="font-mono text-[12px] text-ink">{g}</p>
              <ul className="mt-2">
                {items.map((p) => (
                  <li key={p.slug}>
                    <NavLink to={`/docs/${p.slug}`} onClick={onPick}
                      className={({ isActive }) => `block py-1.5 text-[14px] transition-colors ${isActive ? 'text-ink' : 'text-mute hover:text-ink'}`}>
                      {({ isActive }) => <>{isActive && <span className="mr-2 font-mono text-gold">[</span>}{p.title}{isActive && <span className="ml-2 font-mono text-gold">]</span>}</>}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
        {!list.length && <p className="font-mono text-[12px] text-dim">No page matches.</p>}
      </div>
    </nav>
  )
}

export default function Docs() {
  const { page = 'overview' } = useParams()
  const index = Math.max(0, PAGES.findIndex((p) => p.slug === page))
  const doc = PAGES[index]
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [toc, setToc] = useState<{ id: string; text: string }[]>([])
  const [active, setActive] = useState('')
  const article = useRef<HTMLElement>(null)

  useEffect(() => { document.title = `${doc.title}, Stellarcope docs` }, [doc])

  // table of contents from the rendered h2s, with a scroll spy
  useLayoutEffect(() => {
    const el = article.current
    if (!el) return
    const heads = [...el.querySelectorAll<HTMLElement>('[data-toc]')]
    setToc(heads.map((h) => ({ id: h.id, text: h.textContent ?? '' })))
    setActive(heads[0]?.id ?? '')
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
    }, { rootMargin: '-20% 0px -70% 0px' })
    heads.forEach((h) => io.observe(h))
    if (!reducedMotion()) gsap.fromTo(el, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' })
    const lenis = getLenis()
    lenis?.scrollTo(0, { immediate: true })
    return () => io.disconnect()
  }, [doc])

  const jump = (id: string) => {
    const target = document.getElementById(id)
    if (!target) return
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(target, { offset: -100, duration: 1 })
    else target.scrollIntoView({ behavior: 'smooth' })
    history.replaceState(null, '', `#${id}`)
  }

  const prev = PAGES[index - 1]
  const next = PAGES[index + 1]
  const readMinutes = useMemo(() => Math.max(1, Math.round((article.current?.innerText.split(/\s+/).length ?? 300) / 220)), [doc, toc])

  return (
    <>
      <Nav />
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pb-24 pt-24 sm:px-8 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_200px]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100svh-7rem)] overflow-y-auto pr-2" data-lenis-prevent>
            <Sidebar query={query} onQuery={setQuery} />
          </div>
        </aside>

        <div className="lg:hidden">
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="hair w-full border px-4 py-3 text-left font-mono text-[12px] text-ink">
            {open ? '[ close ]' : `[ ${doc.group} / ${doc.title} ]`}
          </button>
          {open && <div className="hair border border-t-0 p-4"><Sidebar query={query} onQuery={setQuery} onPick={() => setOpen(false)} /></div>}
        </div>

        <main id="main" className="min-w-0">
          <article ref={article} className="max-w-3xl">
            <p className="font-mono text-[12px] text-mute">{doc.group}</p>
            <h1 className="mt-3 text-[clamp(2.2rem,5vw,3.6rem)] leading-[1]">{doc.title}</h1>
            <p className="mt-5 text-lg leading-relaxed text-mute">{doc.lead}</p>
            <p className="mt-4 font-mono text-[11px] text-dim">{readMinutes} min read</p>
            <div className="hair mt-8 border-t" />
            {doc.body}
          </article>

          <div className="mt-20 grid max-w-3xl gap-4 sm:grid-cols-2">
            {prev ? (
              <Link to={`/docs/${prev.slug}`} className="hair group border p-5 transition-colors hover:bg-panel">
                <p className="font-mono text-[11px] text-dim">← previous</p>
                <p className="mt-2 text-ink">{prev.title}</p>
              </Link>
            ) : <span />}
            {next && (
              <Link to={`/docs/${next.slug}`} className="hair group border p-5 text-right transition-colors hover:bg-panel">
                <p className="font-mono text-[11px] text-dim">next →</p>
                <p className="mt-2 text-ink">{next.title}</p>
              </Link>
            )}
          </div>
          <p className="mt-10 max-w-3xl font-mono text-[11px] text-dim">
            Found a gap? <a href={`${REPO}/issues/new`} target="_blank" rel="noreferrer" className="text-mute hover:text-ink">Open an issue ↗</a>
          </p>
        </main>

        <aside className="hidden xl:block">
          <div className="sticky top-24">
            {toc.length > 0 && <p className="font-mono text-[12px] text-ink">On this page</p>}
            <ul className="mt-3">
              {toc.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => jump(t.id)}
                    className={`block py-1.5 text-left text-[13px] transition-colors ${active === t.id ? 'text-ink' : 'text-mute hover:text-ink'}`}>
                    {active === t.id && <span className="mr-1.5 font-mono text-gold">›</span>}{t.text}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
      <Footer />
    </>
  )
}
