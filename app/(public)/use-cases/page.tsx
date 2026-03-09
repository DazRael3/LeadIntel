import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { USE_CASES } from '@/lib/use-cases/registry'
import { VERTICALS } from '@/lib/verticals/registry'
import { VERTICAL_USE_CASES } from '@/lib/verticals/use-cases'
import { getVerticalMessaging } from '@/lib/verticals/messaging'

export const metadata: Metadata = {
  title: 'Use cases | LeadIntel',
  description: 'High-intent outbound plays powered by daily “why now” signals.',
  openGraph: {
    title: 'Use cases | LeadIntel',
    description: 'High-intent outbound plays powered by daily “why now” signals.',
    url: 'https://dazrael.com/use-cases',
    images: [
      {
        url: '/api/og?title=Use%20cases&subtitle=Signal%20%E2%86%92%20shortlist%20%E2%86%92%20send-ready%20outreach',
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
    <MarketingPage title="Use cases" subtitle="Bounded workflow fits + high-intent plays built around “why now” signals.">
      <PageViewTrack event="use_case_view" props={{ page: 'hub' }} />

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardTitle className="text-lg">Best-fit motions</CardTitle>
            <Badge variant="outline">Truthful, bounded</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['b2b_saas_outbound', 'gtm_revops_tooling', 'agency_partner_outbound'] as const).map((k) => {
              const v = VERTICALS[k]
              const m = getVerticalMessaging(k)
              return (
                <div key={k} className="rounded border border-cyan-500/10 bg-background/40 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-foreground">{v.label}</div>
                    <Badge variant="outline" className="text-[11px]">
                      {v.supportLevel === 'supported' ? 'Supported' : 'Vertical-friendly'}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{m.subhead}</div>
                  <div className="mt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Best for:</span> {v.bestForBullets[0]}
                  </div>
                  <div className="mt-3 text-[11px] text-muted-foreground">{m.disclaimer}</div>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild className="neon-border hover:glow-effect">
              <Link href="/#try-sample">Generate a sample digest</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">See pricing</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/templates">Browse templates</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Workflow types</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
          {Object.values(VERTICAL_USE_CASES).map((u) => (
            <div key={u.key} className="rounded border border-cyan-500/10 bg-background/40 p-4">
              <div className="font-medium text-foreground">{u.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{u.description}</div>
              <ul className="mt-3 list-disc pl-5 space-y-1 text-xs">
                {u.recommendedSteps.slice(0, 3).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-3 text-xs">
                {u.relatedRoutes.slice(0, 3).map((r) => (
                  <Link key={r} className="text-cyan-400 hover:underline" href={r}>
                    {r}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

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

