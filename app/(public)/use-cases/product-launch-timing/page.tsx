import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Product launch timing playbook | LeadIntel',
  description: 'Use launch signals to time outreach around high-change periods.',
  openGraph: {
    title: 'Product launch timing playbook | LeadIntel',
    description: 'Use launch signals to time outreach around high-change periods.',
    url: 'https://dazrael.com/use-cases/product-launch-timing',
  },
}

export default function ProductLaunchTimingUseCasePage() {
  return (
    <MarketingPage title="Product launch timing" subtitle="Help teams remove friction when they’re shipping.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'product_launch_timing' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Problem → why now</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Launch cycles are high-change periods: new processes, new support load, new GTM execution. The “why now” angle is
              removing bottlenecks immediately after GA.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Congratulate the launch, then ask about the next bottleneck (pipeline, onboarding, reporting, support).</li>
              <li>Offer a single, concrete next step (audit, checklist, template).</li>
              <li>Be specific to the function you’re selling into.</li>
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
              body={`Subject: Quick question post‑launch\n\nCongrats on the launch.\n\nRight after GA, teams often hit a bottleneck in [X] (e.g., onboarding, reporting, enablement, support). Is that on your radar this month?\n\nIf yes, I can share a short checklist we use to reduce friction in the first 30 days after launch.\n\nWorth a quick 10 minutes?`}
            />
            <Template
              title="LinkedIn DM"
              body={`Congrats on the launch — quick question: what’s the biggest bottleneck in the 30 days post‑GA?\n\nIf it’s [X], happy to share a short checklist to reduce friction.`}
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

