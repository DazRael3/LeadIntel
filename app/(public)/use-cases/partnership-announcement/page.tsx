import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Partnership announcement playbook | LeadIntel',
  description: 'Use partnership announcements as a precise wedge for timely outbound.',
  openGraph: {
    title: 'Partnership announcement playbook | LeadIntel',
    description: 'Use partnership announcements as a precise wedge for timely outbound.',
    url: 'https://dazrael.com/use-cases/partnership-announcement',
  },
}

export default function PartnershipAnnouncementUseCasePage() {
  return (
    <MarketingPage title="Partnership announcements" subtitle="Turn announcements into relevant, specific outreach.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'partnership_announcement' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Problem → why now</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Partnerships usually create new workflows, integrations, and handoffs. The “why now” angle is reducing
              integration friction during rollout.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Reference the partnership and ask about rollout stage (announce → pilot → GA).</li>
              <li>Offer one concrete improvement (handoff, reporting, enablement, compliance).</li>
              <li>Keep it short—one question, one next step.</li>
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
              body={`Subject: Quick question on the partnership rollout\n\nSaw the [PARTNER] announcement — congrats.\n\nAre you already planning how teams will handle [handoff/reporting/enablement] between [A] and [B]? If you want, I can share a short checklist we use to prevent rollout friction.\n\nWorth a quick 10 minutes?`}
            />
            <Template
              title="LinkedIn DM"
              body={`Congrats on the [PARTNER] announcement — quick question: are you already thinking about the rollout handoff between teams?\n\nIf yes, happy to share a short checklist to prevent common rollout friction.`}
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

