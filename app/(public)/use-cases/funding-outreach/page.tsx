import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Funding outreach playbook | LeadIntel',
  description: 'Turn fresh funding signals into timely outreach with a clear “why now” angle.',
  openGraph: {
    title: 'Funding outreach playbook | LeadIntel',
    description: 'Turn fresh funding signals into timely outreach with a clear “why now” angle.',
    url: 'https://dazrael.com/use-cases/funding-outreach',
  },
}

export default function FundingOutreachUseCasePage() {
  return (
    <MarketingPage title="Funding outreach" subtitle="Outreach that lands while priorities and budgets are being set.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'funding_outreach' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Problem → why now</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Fresh funding is a timing window: leadership sets new targets, teams expand, and projects get approved. The goal
              is to reach the account before the vendor shortlist is locked.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Confirm the initiative (growth, GTM, security, infra, revops).</li>
              <li>Offer a narrow, credible wedge—one pain, one next step.</li>
              <li>Ask a question that is easy to answer.</li>
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
              body={`Subject: Quick idea post‑funding\n\nCongrats on the raise — teams often prioritize 1–2 projects right after funding closes.\n\nAre you currently focused on improving [X] (e.g., pipeline coverage, onboarding, reporting, security)? If yes, I can share a 2‑minute idea we’ve used to help similar teams move faster.\n\nWorth a quick 10 minutes this week?`}
            />
            <Template
              title="LinkedIn DM"
              body={`Congrats on the funding — quick question: is the priority this quarter [X] or [Y]?\n\nIf you’re tackling [X], happy to share a short checklist we use to spot “why now” signals and prioritize outreach.`}
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

