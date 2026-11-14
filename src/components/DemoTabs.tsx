import { NavLink } from 'react-router-dom'

const LINKS = [
  { to: '/demo', label: 'Tenant' },
  { to: '/operator', label: 'Operator' },
  { to: '/p/halcyon-dex', label: 'Public card' },
]

/** switches between the three product views; sits under the site navbar */
export default function DemoTabs({ note }: { note?: string }) {
  return (
    <div className="hair border-b pt-16">
      <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
        <nav aria-label="Product views" className="flex gap-6 overflow-x-auto">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end className={({ isActive }) => `tab shrink-0 ${isActive ? 'text-ink' : ''}`} aria-selected={undefined}>
              {({ isActive }) => <span aria-current={isActive ? 'page' : undefined} className={isActive ? 'text-ink' : ''}>{isActive ? <><span className="text-gold">[ </span>{l.label}<span className="text-gold"> ]</span></> : l.label}</span>}
            </NavLink>
          ))}
        </nav>
        {note && <p className="hidden font-mono text-[11px] text-dim sm:block">{note}</p>}
      </div>
    </div>
  )
}
