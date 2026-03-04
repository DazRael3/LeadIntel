import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { JsonLd } from '@/components/seo/JsonLd'
import { COMPARE_PAGES } from '@/lib/compare/registry'

export const metadata: Metadata = {
  title: 'Compare | LeadIntel',
  description: 'See where LeadIntel fits—and when another approach is a better match.',
  alternates: { canonical: 'https://dazrael.com/compare' },
  openGraph: {
    title: 'Compare | LeadIntel',
    description: 'See where LeadIntel fits—and when another approach is a better match.',
    url: 'https://dazrael.com/compare',
    images: [
      {
        url: '/api/og?title=Compare&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function CompareHubPage() {
  const pages = COMPARE_PAGES

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'LeadIntel comparisons',
    itemListElement: pages.map((p, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      url: `https://dazrael.com/compare/${p.slug}`,
      name: `LeadIntel vs ${p.competitorName}`,
    })),
  }

  return (
    <MarketingPage title="Compare" subtitle="See where LeadIntel fits—and when another approach is a better match.">
      <JsonLd data={jsonLd} />
      <PageViewTrack event="compare_hub_view" props={{ page: 'compare' }} />

      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pages.map((p) => (
            <Card key={p.slug} className="border-cyan-500/20 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-lg">LeadIntel vs {p.competitorName}</CardTitle>
                  <Badge variant="outline">{p.competitorType}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">{p.bestFor}</div>
                <Button asChild className="neon-border hover:glow-effect w-full sm:w-auto">
                  <Link href={`/compare/${p.slug}`}>View comparison</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Related</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            <Link className="text-cyan-400 hover:underline" href="/pricing">
              Pricing
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/templates">
              Templates
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/use-cases">
              Use cases
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/how-scoring-works">
              How scoring works
            </Link>
          </CardContent>
        </Card>
      </div>
    </MarketingPage>
  )
}

