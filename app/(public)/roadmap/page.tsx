import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Roadmap | LeadIntel',
  description: 'Directional product focus: deeper signal context, stronger actionability, and better team operations.',
  alternates: { canonical: 'https://dazrael.com/roadmap' },
  openGraph: {
    title: 'Roadmap | LeadIntel',
    description: 'Directional product focus: deeper signal context, stronger actionability, and better team operations.',
    url: 'https://dazrael.com/roadmap',
    images: [
      {
        url: '/api/og?title=Roadmap&subtitle=Directional%20product%20focus',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function RoadmapPage() {
  return (
    <MarketingPage title="Where LeadIntel is getting stronger" subtitle="Directional product focus (not committed ship dates).">
      <PageViewTrack event="roadmap_section_viewed" props={{ page: 'roadmap' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Roadmap framing</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div>
              LeadIntel already helps teams move from fresh signal to send-ready outreach quickly. The next wave of improvements is focused on deeper signal
              context, stronger actionability, and better team operations.
            </div>
            <div className="text-xs text-muted-foreground">
              This roadmap is directional product focus—priorities can shift based on buyer needs and operational constraints.
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">P0 now</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>First-party intent + website-visitor layer</li>
                <li>Contact/persona recommendations inside accounts</li>
                <li>Signal momentum timeline</li>
                <li>Stronger action center beyond plain export</li>
                <li>Compare pages for the modern competitive set</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">P1 next</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>Buying-group capture</li>
                <li>Saved account briefs</li>
                <li>Workflow recipes for CRM and sequencer handoff</li>
                <li>Stronger customer proof program</li>
                <li>Interactive tour that feels real, not simulated</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">P2 later</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                <li>Team analytics on what signals convert</li>
                <li>Deeper enterprise controls</li>
                <li>Bring-your-own-signal ingestion</li>
              </ul>
            </CardContent>
          </Card>
        </div>

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

