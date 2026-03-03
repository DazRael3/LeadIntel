import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Expansion signals playbook | LeadIntel',
  description: 'Use expansion signals to time outreach around process change and scaling.',
  openGraph: {
    title: 'Expansion signals playbook | LeadIntel',
    description: 'Use expansion signals to time outreach around process change and scaling.',
    url: 'https://dazrael.com/use-cases/expansion-signals',
  },
}

export default function ExpansionSignalsUseCasePage() {
  return (
    <MarketingPage title="Expansion signals" subtitle="Expansion is when messy processes show up—help standardize early.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'expansion_signals' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Problem → why now</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Expansion adds complexity: regions, teams, reporting lines, and handoffs. The “why now” angle is preventing
              process debt before it becomes entrenched.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Anchor on a specific scaling pain (handoffs, reporting, enablement, onboarding).</li>
              <li>Offer a short audit or checklist to identify the bottleneck.</li>
              <li>Keep the CTA small: a 10-minute working session.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Template preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Template
              title="Short email"
              body={`Subject: Quick scaling checklist\n\nWhen teams expand, the first pain usually shows up in [handoffs/reporting/enablement/onboarding].\n\nIs that on your radar right now? If yes, I can share a short checklist to spot the bottleneck and prioritize fixes.\n\nWorth a quick 10 minutes?`}
            />
            <Template
              title="LinkedIn DM"
              body={`Expansion usually exposes friction in [handoffs/reporting/enablement].\n\nIf that’s on your radar, I can share a short checklist to spot the bottleneck and prioritize fixes.`}
            />
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/#try-sample">Try a sample digest</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/use-cases">Back to use cases</Link>
          </Button>
        </div>
      </div>
    </MarketingPage>
  )
}

function Template(props: { title: string; body: string }) {
  return (
    <div className="rounded border border-cyan-500/20 bg-background/50 p-4">
      <div className="text-xs font-medium text-foreground">{props.title}</div>
      <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{props.body}</pre>
    </div>
  )
}

