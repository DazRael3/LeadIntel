import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { JsonLd } from '@/components/seo/JsonLd'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { TourStepper } from '@/components/marketing/TourStepper'
import { InteractiveWorkspaceDemo } from '@/components/marketing/InteractiveWorkspaceDemo'

export const metadata: Metadata = {
  title: 'Product tour | LeadIntel',
  description: 'Interactive product preview: why-now signals, daily shortlist, explainable scoring, and send-ready outreach.',
  alternates: { canonical: 'https://dazrael.com/tour' },
  openGraph: {
    title: 'Product tour | LeadIntel',
    description: 'Interactive product preview: why-now signals, daily shortlist, explainable scoring, and send-ready outreach.',
    url: 'https://dazrael.com/tour',
    images: [
      {
        url: '/api/og?title=Product%20tour&subtitle=Why-now%20signals%20%E2%86%92%20send-ready%20outreach',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function TourPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: 'LeadIntel product tour',
    url: 'https://dazrael.com/tour',
    description: 'From signals to send-ready outreach in minutes.',
  }

  return (
    <MarketingPage title="Product tour" subtitle="Interactive product preview: signal → shortlist → explain → draft → action.">
      <JsonLd data={jsonLd} />
      <PageViewTrack event="tour_preview_viewed" props={{ page: 'tour' }} />

      <div className="grid grid-cols-1 gap-6">
        <InteractiveWorkspaceDemo />
        <TourStepper />

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Next steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              Want to compare workflows? See <Link className="text-cyan-400 hover:underline" href="/compare">compare pages</Link>.
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild variant="outline">
                <Link href="/templates">Browse templates</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/use-cases">Explore use cases</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/trust">Trust Center</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/pricing">See pricing</Link>
              </Button>
              <Button asChild className="neon-border hover:glow-effect">
                <Link href="/#try-sample">Generate a sample digest</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingPage>
  )
}

