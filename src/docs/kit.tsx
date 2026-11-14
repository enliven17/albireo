import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

// Building blocks for docs pages, in the brand language: mono headings, hairlines,
// bracketed notes, square code blocks with a copy action.

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export function H2({ children }: { children: string }) {
  const id = slugify(children)
  return (
    <h2 id={id} data-toc className="group mt-14 scroll-mt-28 text-2xl leading-tight">
      <a href={`#${id}`} className="hover:text-ink">{children}</a>
    </h2>
  )
}

export const P = ({ children }: { children: ReactNode }) => <p className="mt-5 text-[15px] leading-[1.75] text-mute">{children}</p>
export const C = ({ children }: { children: ReactNode }) => <code className="bg-raise px-1.5 py-0.5 font-mono text-[13px] text-ink">{children}</code>
export const A = ({ to, children }: { to: string; children: ReactNode }) =>
  to.startsWith('http') ? <a href={to} target="_blank" rel="noreferrer" className="text-ink underline decoration-dim underline-offset-4 hover:decoration-ink">{children}</a>
    : <Link to={to} className="text-ink underline decoration-dim underline-offset-4 hover:decoration-ink">{children}</Link>

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-5">
      {items.map((it, i) => (
        <li key={i} className="hair flex gap-4 border-t py-3 text-[15px] leading-relaxed text-mute">
          <span className="font-mono text-gold" aria-hidden>+</span><span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

export function Note({ kind = 'note', children }: { kind?: 'note' | 'status' | 'privacy'; children: ReactNode }) {
  const tone = kind === 'status' ? 'text-blue' : 'text-gold'
  return (
    <div className="hair mt-6 border bg-panel p-5 text-[14px] leading-relaxed text-mute">
      <span className={`mr-2 font-mono text-[12px] ${tone}`}>[ {kind} ]</span>{children}
    </div>
  )
}

export function Code({ code, file, lang = '' }: { code: string; file?: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { setCopied(false) }
  }
  return (
    <div className="hair mt-6 border bg-panel">
      <div className="hair flex items-center justify-between border-b px-4 py-2">
        <span className="font-mono text-[11px] text-dim">{file ?? lang}</span>
        <button type="button" onClick={copy} className="font-mono text-[11px] text-mute transition-colors hover:text-ink">{copied ? 'copied' : 'copy'}</button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-[12.5px] leading-[1.8] text-ink" data-lenis-prevent>{code}</pre>
    </div>
  )
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-6 overflow-x-auto" data-lenis-prevent>
      <table className="w-full min-w-[520px] text-left text-[14px]">
        <thead><tr className="hair border-b">{head.map((h) => <th key={h} className="py-3 pr-4 font-mono text-[12px] font-normal text-mute">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="hair border-b last:border-0">
              {r.map((c, j) => <td key={j} className={`py-3 pr-4 align-top ${j === 0 ? 'font-mono text-[13px] text-ink' : 'text-mute'}`}>{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
