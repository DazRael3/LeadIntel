import type { ReactNode } from 'react'
import { TopNav } from '@/components/TopNav'
import { SiteFooter } from '@/components/SiteFooter'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background terminal-grid flex flex-col">
      <TopNav />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}

