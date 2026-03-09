import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { AuthedSettingsStamp } from '@/components/marketing/AuthedSettingsStamp'

export const metadata: Metadata = {
  title: 'How scoring works | LeadIntel',
  description: 'A clear explanation of LeadIntel’s 0–100 lead score and what it means.',
  openGraph: {
    title: 'How scoring works | LeadIntel',
    description: 'A clear explanation of LeadIntel’s 0–100 lead score and what it means.',
    url: 'https://dazrael.com/how-scoring-works',
    images: [
      {
        url: '/api/og?title=How%20scoring%20works&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function HowScoringWorksPage() {
  return (
    <MarketingPage
      title="How scoring works"
      subtitle="LeadIntel uses a deterministic, reasons-based 0–100 score to help you prioritize daily outreach."
    >
      <PageViewTrack event="trust_page_view" props={{ page: 'how_scoring_works' }} />
      <AuthedSettingsStamp payload={{ scoring_viewed_at: new Date().toISOString() }} sessionKey="scoring_viewed" />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">What goes into the score</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium text-foreground">ICP fit</span>: how closely the account matches your stated
                target.
              </li>
              <li>
                <span className="font-medium text-foreground">Trigger recency</span>: how fresh the underlying signal is.
              </li>
              <li>
                <span className="font-medium text-foreground">Signal strength</span>: how specific and actionable the event
                appears (e.g., funding vs. vague mention).
              </li>
            </ul>
            <p>
              The goal is consistency: similar inputs should produce similar outputs so you can build a reliable daily
              workflow.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Example breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Example
              name="Acme Security"
              score={86}
              reasons={['ICP fit: security buyers + mid-market', 'Hiring spike in Sales Engineering', 'Recent product launch']}
            />
            <Example
              name="Northwind Logistics"
              score={71}
              reasons={['ICP fit: ops-heavy teams', 'Partnership announcement', 'Signal freshness: last 14 days']}
            />
            <Example
              name="BlueSky HR"
              score={52}
              reasons={['Partial ICP fit', 'Press mention (low specificity)', 'Older signal']}
            />
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">What the score is not</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Not a guarantee of purchase.</li>
              <li>Not a substitute for qualification.</li>
              <li>A prioritization tool to focus your limited daily outbound time.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">How to improve results</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Tighten your ICP so “fit” is clear.</li>
              <li>Add 10–25 strong accounts to your watchlist so the digest has enough signal density.</li>
              <li>Use consistent templates so you can measure what messaging works.</li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/#try-sample">Try a sample digest</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup?redirect=/onboarding">Sign up</Link>
          </Button>
        </div>
      </div>
    </MarketingPage>
  )
}

function Example(props: { name: string; score: number; reasons: string[] }) {
  return (
    <div className="rounded border border-cyan-500/20 bg-background/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold text-foreground">{props.name}</div>
        <Badge variant="outline">
          Score <span className="ml-1 font-semibold text-foreground">{props.score}/100</span>
        </Badge>
      </div>
      <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground space-y-1">
        {props.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  )
}

