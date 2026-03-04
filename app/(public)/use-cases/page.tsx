import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

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
  const useCases: UseCase[] = [
    {
      href: '/use-cases/funding-outreach',
      title: 'Funding outreach',
      problem: 'New capital changes priorities and timelines.',
      whyNow: 'Reach out while budgets and project scopes are being set.',
      template: '“Congrats on the raise — are you prioritizing X in the next 60 days?”',
      tag: 'Funding',
    },
    {
      href: '/use-cases/hiring-spike',
      title: 'Hiring spike outreach',
      problem: 'Hiring often signals growth initiatives or tooling gaps.',
      whyNow: 'Catch the build phase before a vendor is locked in.',
      template: '“Noticed you’re hiring for Y — is this tied to Z initiative?”',
      tag: 'Hiring',
    },
    {
      href: '/use-cases/partnership-announcement',
      title: 'Partnership announcements',
      problem: 'Partnerships create integration needs and new workflows.',
      whyNow: 'Offer a specific wedge aligned to the announcement.',
      template: '“Saw the partnership — curious how you’re handling the handoff between A and B?”',
      tag: 'Partnership',
    },
    {
      href: '/use-cases/product-launch-timing',
      title: 'Product launch timing',
      problem: 'Launch cycles increase cross-functional load and tooling demand.',
      whyNow: 'Help remove friction while the team is shipping.',
      template: '“Congrats on the launch — teams often hit X bottleneck right after GA.”',
      tag: 'Launch',
    },
    {
      href: '/use-cases/competitive-displacement',
      title: 'Competitive displacement',
      problem: 'Competitors change pricing, features, or reliability.',
      whyNow: 'Use a crisp battlecard angle when churn risk is highest.',
      template: '“If you’re re-evaluating vendor Y, I can share a quick comparison checklist.”',
      tag: 'Battlecard',
    },
    {
      href: '/use-cases/expansion-signals',
      title: 'Expansion signals',
      problem: 'Expansion adds complexity: regions, teams, and processes.',
      whyNow: 'Pitch standardization and visibility before the org scales.',
      template: '“Expansion usually exposes gaps in X — worth a fast audit?”',
      tag: 'Expansion',
    },
  ]

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

