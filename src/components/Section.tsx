import type { ReactNode } from 'react'

export function Eyebrow({ index, children }: { index: string; children: ReactNode }) {
  return (
    <p className="label flex items-baseline gap-3" data-reveal>
      <span className="text-gold">{index}</span>
      <span>{children}</span>
    </p>
  )
}

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1440px] px-4 sm:px-8 ${className}`}>{children}</div>
}
