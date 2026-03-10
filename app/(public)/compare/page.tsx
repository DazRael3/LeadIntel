import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { JsonLd } from '@/components/seo/JsonLd'
import { COMPARE_PAGES, COMPETITOR_MATRIX } from '@/lib/compare/registry'
import { CompetitorMatrix } from '@/components/compare/CompetitorMatrix'
import { CategoryStrengthTable } from '@/components/compare/CategoryStrengthTable'

export const metadata: Metadata = {
  title: 'Compare | LeadIntel',
  description: 'A buyer-grade comparison hub for signal-based outbound workflows and why-now execution.',
  alternates: { canonical: 'https://dazrael.com/compare' },
  openGraph: {
    title: 'Compare | LeadIntel',
    description: 'A buyer-grade comparison hub for signal-based outbound workflows and why-now execution.',
    url: 'https://dazrael.com/compare',
    images: [
      {
        url: '/api/og?title=Compare&subtitle=Why-now%20signals%20%E2%86%92%20send-ready%20outreach',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function CompareHubPage() {
  const pages = COMPARE_PAGES
  const matrixEntries = COMPETITOR_MATRIX.map((e) => ({
    key: e.key,
    name: e.name,
    score: e.threatScore,
    threatSummary: e.threatSummary,
    leadIntelWins: e.leadIntelWins,
    theyDoBetter: e.theyDoBetter,
    compareHref: e.compareSlug ? `/compare/${e.compareSlug}` : undefined,
  }))

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
    <MarketingPage title="Compare" subtitle="Buyer-grade comparisons for signal-based outbound workflows.">
      <JsonLd data={jsonLd} />
      <PageViewTrack event="compare_page_viewed" props={{ kind: 'hub' }} />

      <div className="grid grid-cols-1 gap-6">
        <CompetitorMatrix entries={matrixEntries} />

        <CategoryStrengthTable
          title="How LeadIntel fits the category"
          rows={[
            { category: 'Clarity', leadintel: 'Strong: simple daily loop and explainable scoring.', competitorSet: 'Often broad and multi-module; can be harder to evaluate quickly.' },
            { category: 'Explainability', leadintel: 'Strong: visible reasons behind the 0–100 score + momentum context.', competitorSet: 'Often deeper but can be less transparent or more complex.' },
            { category: 'Speed-to-value', leadintel: 'Strong: no-signup sample + quick workflow understanding.', competitorSet: 'Frequently requires deeper setup and longer evaluation.' },
            { category: 'People depth', leadintel: 'Focused: persona-level recommendations tied to signals (not a contact database).', competitorSet: 'Often stronger named-contact depth and enrichment.' },
            { category: 'First-party intent', leadintel: 'When observed: domain-matched visitor + intent freshness; empty states are explicit.', competitorSet: 'Often broader tracking/integrations; varies widely.' },
            { category: 'Momentum visibility', leadintel: 'Yes: score movement and recent contributing signals.', competitorSet: 'Varies by product; often deeper, sometimes less explainable.' },
            { category: 'Signal breadth', leadintel: 'Focused: best when timing is the priority.', competitorSet: 'Typically stronger breadth and identity capture.' },
            { category: 'Workflow depth', leadintel: 'Action packaging: variants + briefs + webhooks/exports + team governance.', competitorSet: 'Often stronger automation and enterprise depth.' },
          ]}
        />

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
            <Link className="text-cyan-400 hover:underline" href="/tour">
              Product tour
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/templates">
              Templates
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/use-cases">
              Use cases
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/trust">
              Trust Center
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

