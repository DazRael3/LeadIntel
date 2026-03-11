import type { ReactNode } from 'react'

export function MarketingPage(props: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-16">
      <div className="max-w-4xl">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bloomberg-font neon-cyan">{props.title}</h1>
        {props.subtitle ? <p className="mt-3 text-muted-foreground">{props.subtitle}</p> : null}
      </div>
      <div className="mt-12">{props.children}</div>
    </div>
  )
}

