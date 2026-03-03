import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Hiring spike outreach playbook | LeadIntel',
  description: 'Use hiring spikes as a “build phase” signal to time outbound before vendors are locked in.',
  openGraph: {
    title: 'Hiring spike outreach playbook | LeadIntel',
    description: 'Use hiring spikes as a “build phase” signal to time outbound before vendors are locked in.',
    url: 'https://dazrael.com/use-cases/hiring-spike',
  },
}

export default function HiringSpikeUseCasePage() {
  return (
    <MarketingPage title="Hiring spike outreach" subtitle="Catch accounts during the build—before tooling decisions settle.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'hiring_spike' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Problem → why now</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              A hiring spike can signal a new initiative, a process gap, or a scale-up phase. The “why now” angle is
              preventing friction while the org is growing.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Anchor to a specific role (RevOps, Sales Eng, Security, Marketing Ops).</li>
              <li>Ask what initiative the role supports.</li>
              <li>Offer a concrete artifact (checklist, benchmark, template) rather than a generic pitch.</li>
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
              body={`Subject: Quick question on the hiring push\n\nNoticed you’re hiring for [ROLE].\n\nIs that role tied to a specific initiative (e.g., better pipeline coverage, onboarding, reporting, security)? If yes, I can send a short checklist we use to spot “why now” signals and prioritize accounts.\n\nWorth a quick 10 minutes?`}
            />
            <Template
              title="LinkedIn DM"
              body={`Saw you’re hiring for [ROLE] — quick question: is that tied to an initiative like [X]?\n\nIf yes, happy to share a short checklist on how teams prioritize accounts and outreach during growth phases.`}
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

