import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Competitive displacement playbook | LeadIntel',
  description: 'Use battlecard-style angles when an account is evaluating alternatives.',
  openGraph: {
    title: 'Competitive displacement playbook | LeadIntel',
    description: 'Use battlecard-style angles when an account is evaluating alternatives.',
    url: 'https://dazrael.com/use-cases/competitive-displacement',
  },
}

export default function CompetitiveDisplacementUseCasePage() {
  return (
    <MarketingPage title="Competitive displacement" subtitle="A crisp POV and checklist beats generic comparison claims.">
      <PageViewTrack event="use_case_view" props={{ useCase: 'competitive_displacement' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Problem → why now</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Displacement wins happen when you bring structure to a messy evaluation: what matters, how to compare, and how to
              decide quickly. The “why now” angle is a clean decision checklist.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Lead with a 3-point checklist (requirements, risks, rollout).</li>
              <li>Offer a short “battlecard” summary without trash-talking competitors.</li>
              <li>Ask where they are in evaluation (research → shortlist → pilot).</li>
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
              body={`Subject: Quick evaluation checklist\n\nIf you’re evaluating alternatives to [VENDOR], here’s a quick checklist to make the decision fast:\n1) Must-have requirements\n2) Rollout + adoption risks\n3) Reporting + long-term maintenance\n\nIf you want, I can share a 1‑page battlecard-style comparison for teams in your space.\n\nWorth a quick 10 minutes?`}
            />
            <Template
              title="LinkedIn DM"
              body={`If you’re evaluating alternatives to [VENDOR], I can share a 1‑page checklist we use to compare options quickly (requirements, rollout risk, maintenance).\n\nWant it?`}
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

