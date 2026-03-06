import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { USE_CASES } from '@/lib/use-cases/registry'

export const metadata: Metadata = {
  title: 'Use cases | LeadIntel',
  description: 'High-intent outbound plays powered by daily “why now” signals.',
  openGraph: {
    title: 'Use cases | LeadIntel',
    description: 'High-intent outbound plays powered by daily “why now” signals.',
    url: 'https://dazrael.com/use-cases',
    images: [
      {
        url: '/api/og?title=Use%20cases&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

type UseCase = {
  href: string
  title: string
  problem: string
  whyNow: string
  template: string
  tag: string
}

export default function UseCasesPage() {
  const useCases: UseCase[] = USE_CASES.map((u) => ({
    href: u.href,
    title: u.title,
    problem: u.problem,
    whyNow: u.whyNow,
    template: u.templatePreview,
    tag: u.tag,
  }))

  return (
    <MarketingPage title="Use cases" subtitle="Six high-intent outbound plays built around “why now” signals.">
      <PageViewTrack event="use_case_view" props={{ page: 'hub' }} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {useCases.map((u) => (
          <Card key={u.href} className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg">{u.title}</CardTitle>
                <Badge variant="outline">{u.tag}</Badge>
              </div>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>
                <span className="font-medium text-foreground">Problem:</span> {u.problem}
              </div>
              <div>
                <span className="font-medium text-foreground">Why now:</span> {u.whyNow}
              </div>
              <div className="rounded border border-cyan-500/20 bg-background/50 p-3 text-xs">
                <div className="text-foreground font-medium">Template preview</div>
                <div className="mt-1 text-muted-foreground">{u.template}</div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild className="neon-border hover:glow-effect">
                  <Link href={u.href}>View play</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/#try-sample">Try sample</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </MarketingPage>
  )
}

