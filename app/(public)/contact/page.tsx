import type { Metadata } from 'next'
import Link from 'next/link'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { LeadCaptureCard } from '@/components/marketing/LeadCaptureCard'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Book a Demo | LeadIntel',
  description: 'Request a LeadIntel demo and get a follow-up with practical next steps.',
  alternates: { canonical: 'https://dazrael.com/contact' },
  openGraph: {
    title: 'Book a Demo | LeadIntel',
    description: 'Request a LeadIntel demo and get a follow-up with practical next steps.',
    url: 'https://dazrael.com/contact',
    images: [
      {
        url: '/api/og?title=Book%20a%20Demo&subtitle=Signal-first%20outbound%20workflow',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function ContactPage() {
  return (
    <MarketingPage title="Book a demo" subtitle="Share your workflow goals and we will follow up with a practical next-step plan.">
      <PageViewTrack event="contact_page_viewed" props={{ page: 'contact' }} />
      <div className="space-y-6">
        <LeadCaptureCard
          surface="contact"
          intent="demo"
          title="Request a tailored walkthrough"
          subtitle="Tell us your use case. We will send a confirmation and follow up directly."
          ctaLabel="Request demo"
        />

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">While you wait</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div>Preview the product flow and evaluate plan fit before the demo.</div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild variant="outline" size="sm">
                <Link href="/#try-sample">Generate sample digest</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/pricing">Review pricing</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/support">Open support</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingPage>
  )
}
