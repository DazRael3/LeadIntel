import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Changelog | LeadIntel',
  description: 'Product updates and notable changes.',
  openGraph: {
    title: 'Changelog | LeadIntel',
    description: 'Product updates and notable changes.',
    url: 'https://dazrael.com/changelog',
    images: [
      {
        url: '/api/og?title=Changelog&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function ChangelogPage() {
  return (
    <MarketingPage title="Changelog" subtitle="Notable product updates.">
      <PageViewTrack event="trust_page_view" props={{ page: 'changelog' }} />

      <div className="grid grid-cols-1 gap-6">
        <Entry
          date="2026-03-03"
          title="Trust center + SEO foundations"
          bullets={[
            'Added security/privacy/terms pages and a status page.',
            'Added robots + sitemap and structured metadata.',
            'Improved marketing navigation and footer trust rail.',
          ]}
        />
        <Entry
          date="2026-01-22"
          title="Homepage conversion upgrades"
          bullets={[
            'Added a no-signup sample generator and a 1-minute demo loop.',
            'Improved above-the-fold clarity and activation guidance.',
          ]}
        />
      </div>
    </MarketingPage>
  )
}

function Entry(props: { date: string; title: string; bullets: string[] }) {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{props.title}</CardTitle>
        <div className="text-xs text-muted-foreground">{props.date}</div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <ul className="list-disc pl-5 space-y-1">
          {props.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

