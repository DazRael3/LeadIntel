import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Roadmap | LeadIntel',
  description: 'Product direction and operating principles for LeadIntel.',
  openGraph: {
    title: 'Roadmap | LeadIntel',
    description: 'Product direction and operating principles for LeadIntel.',
    url: 'https://dazrael.com/roadmap',
  },
}

export default function RoadmapPage() {
  return (
    <MarketingPage title="Roadmap" subtitle="Product direction and what we optimize for.">
      <PageViewTrack event="trust_page_view" props={{ page: 'roadmap' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Operating principles</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Signal quality over volume: fewer alerts, more “why now”.</li>
              <li>Deterministic workflows: repeatable scoring and templates that teams can operationalize.</li>
              <li>Fast time-to-value: setup → watchlist → first digest.</li>
              <li>Security and reliability as defaults (least privilege, safe logging, rate limits).</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Focus areas</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Better “why now” explanations tied to specific triggers.</li>
              <li>More consistent templates and team-level governance.</li>
              <li>Operational visibility (status, versioning, health checks).</li>
              <li>Clearer trust documentation and buyer enablement.</li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/#try-sample">Try a sample digest</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/pricing">Pricing</Link>
          </Button>
        </div>
      </div>
    </MarketingPage>
  )
}

