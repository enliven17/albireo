import type { ReactNode } from 'react'

export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-[1440px] px-4 sm:px-8 ${className}`}>{children}</div>
}
