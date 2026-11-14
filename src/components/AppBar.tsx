import { Link, NavLink } from 'react-router-dom'
import { Logo } from './Mark'

const LINKS = [
  { to: '/demo', label: 'Tenant' },
  { to: '/operator', label: 'Operator' },
  { to: '/p/halcyon-dex', label: 'Public card' },
]

export default function AppBar() {
  return (
    <header className="hair sticky top-0 z-50 border-b bg-space/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-8">
        <div className="flex items-center gap-6">
          <Link to="/" aria-label="Albireo home"><Logo size={16} /></Link>
          <nav aria-label="Demo" className="hidden items-center gap-5 sm:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} className={({ isActive }) => `font-mono text-[12px] transition-colors ${isActive ? 'text-ink' : 'text-mute hover:text-ink'}`}>
                {({ isActive }) => <>{isActive && <span className="text-gold">[</span>}{l.label}{isActive && <span className="text-gold">]</span>}</>}
              </NavLink>
            ))}
          </nav>
        </div>
        <p className="font-mono text-[11px] text-dim">demo data</p>
      </div>
      <nav aria-label="Demo" className="hair flex gap-5 overflow-x-auto border-t px-4 py-2 sm:hidden">
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} className={({ isActive }) => `shrink-0 font-mono text-[12px] ${isActive ? 'text-ink' : 'text-mute'}`}>{l.label}</NavLink>
        ))}
      </nav>
    </header>
  )
}
