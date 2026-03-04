import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Acceptable Use | LeadIntel',
  description: 'Rules for using LeadIntel safely and responsibly.',
  openGraph: {
    title: 'Acceptable Use | LeadIntel',
    description: 'Rules for using LeadIntel safely and responsibly.',
    url: 'https://dazrael.com/acceptable-use',
  },
}

export default function AcceptableUsePage() {
  return (
    <MarketingPage title="Acceptable Use" subtitle="Use LeadIntel responsibly. Abuse and spam are not allowed.">
      <PageViewTrack event="trust_page_view" props={{ page: 'acceptable_use' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Prohibited activity</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li>Illegal activity, fraud, or impersonation.</li>
              <li>Credential stuffing, brute force attacks, or attempts to bypass access controls.</li>
              <li>Scraping abuse or automated traffic intended to degrade the service.</li>
              <li>Sending spam or harassment using generated content.</li>
              <li>Attempting to access or exfiltrate data that is not yours.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Rate limits</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              We enforce rate limits on both public and authenticated endpoints to reduce abuse and keep the platform stable.
              Repeated violations may result in temporary blocks.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Data sources and compliance</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              You are responsible for ensuring your outbound activity complies with applicable laws and the terms of your data
              sources and outreach channels.
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/pricing">See pricing</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/security">Security overview</Link>
          </Button>
        </div>
      </div>
    </MarketingPage>
  )
}

