import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { JsonLd } from '@/components/seo/JsonLd'
import { CompareCtas } from '@/components/marketing/CompareCtas'
import { CompareBottomCtas } from '@/components/marketing/CompareBottomCtas'
import { COMPARE_PAGES } from '@/lib/compare/registry'

type Params = { slug: string }

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params
  const page = COMPARE_PAGES.find((p) => p.slug === slug)
  if (!page) return {}

  const title = `LeadIntel vs ${page.competitorName} | Why-now outbound comparison`
  const url = `https://dazrael.com/compare/${page.slug}`
  const og = `/api/og?title=${encodeURIComponent(`LeadIntel vs ${page.competitorName}`)}&subtitle=${encodeURIComponent(
    'Why-now signals → send-ready outreach'
  )}`

  return {
    title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: page.description,
      url,
      images: [{ url: og, width: 1200, height: 630 }],
    },
  }
}

export default async function CompareDetailPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params
  const page = COMPARE_PAGES.find((p) => p.slug === slug)
  if (!page) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `LeadIntel vs ${page.competitorName}`,
    url: `https://dazrael.com/compare/${page.slug}`,
    description: page.description,
    about: [
      { '@type': 'SoftwareApplication', name: 'LeadIntel', url: 'https://dazrael.com' },
      { '@type': 'Thing', name: page.competitorName },
    ],
  }

  return (
    <MarketingPage title={`LeadIntel vs ${page.competitorName}`} subtitle={page.hero.summary}>
      <JsonLd data={jsonLd} />
      <PageViewTrack event="competitor_compare_page_viewed" props={{ slug: page.slug, competitor: page.competitorName }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Quick verdict</CardTitle>
              <Badge variant="outline">{page.competitorType}</Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div>{page.quickVerdict ?? page.hero.summary}</div>
            <CompareCtas slug={page.slug} />
            <div className="text-xs text-muted-foreground">
              Conservative comparison. If a detail varies by plan or setup, we label it as such.
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-lg">Summary</CardTitle>
              <Badge variant="outline">{page.competitorType}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">{page.hero.summary}</div>
            <div className="text-sm text-muted-foreground">{page.bestFor}</div>
            <div className="text-xs text-muted-foreground">
              Conservative comparison. If a detail varies by plan or setup, we label it as such.
            </div>
          </CardContent>
        </Card>

        {page.bestForSections ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-cyan-500/20 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Best for (LeadIntel)</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  {page.bestForSections.leadintel.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-cyan-500/20 bg-card/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Best for ({page.competitorName})</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <ul className="list-disc pl-5 space-y-1">
                  {page.bestForSections.competitor.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>
                <div className="font-medium text-foreground">LeadIntel focus</div>
                <div className="mt-1">{page.hero.atAGlance.leadintelFocus}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">{page.competitorName} focus</div>
                <div className="mt-1">{page.hero.atAGlance.competitorFocus}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Where each fits</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <div>
                <div className="font-medium text-foreground">When LeadIntel is a strong fit</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {page.whenLeadIntel.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-foreground">When {page.competitorName} is a strong fit</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {page.whenCompetitor.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Where LeadIntel is better</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                {(page.whereLeadIntelBetter ?? page.whoWins.leadintel).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Where {page.competitorName} is stronger</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                {(page.whereCompetitorStronger ?? page.whoWins.competitor).map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Use together</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                {page.useTogether.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <Link className="text-cyan-400 hover:underline" href="/tour">
                  Product tour
                </Link>
                <Link className="text-cyan-400 hover:underline" href="/templates">
                  Templates
                </Link>
                <Link className="text-cyan-400 hover:underline" href="/pricing">
                  Pricing
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Implementation / migration steps</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ol className="list-decimal pl-5 space-y-1">
                {page.migrationSteps.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Who wins for…</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground grid grid-cols-1 gap-5">
              <div>
                <div className="font-medium text-foreground">LeadIntel wins for</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {page.whoWins.leadintel.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="font-medium text-foreground">{page.competitorName} wins for</div>
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {page.whoWins.competitor.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Evaluation checklist</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <ul className="list-disc pl-5 space-y-1">
                {page.checklist.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Comparison table</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-cyan-500/10 text-xs text-muted-foreground">
                  <th className="text-left py-2 pr-3">Dimension</th>
                  <th className="text-left py-2 pr-3">LeadIntel</th>
                  <th className="text-left py-2">{page.competitorName}</th>
                </tr>
              </thead>
              <tbody>
                {page.table.map((r) => (
                  <tr key={r.dimension} className="border-b border-cyan-500/10">
                    <td className="py-2 pr-3 font-medium text-foreground">{r.dimension}</td>
                    <td className="py-2 pr-3 text-muted-foreground">{r.leadintel}</td>
                    <td className="py-2 text-muted-foreground">{r.competitor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">FAQs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-4">
            {page.faqs.map((f) => (
              <div key={f.q}>
                <div className="font-medium text-foreground">{f.q}</div>
                <div className="mt-1">{f.a}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{page.finalRecommendation ? 'Final recommendation' : page.ctas.bottomTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {page.finalRecommendation ? (
              <div className="text-sm text-muted-foreground">{page.finalRecommendation}</div>
            ) : (
              <div className="text-sm text-muted-foreground">{page.ctas.bottomBody}</div>
            )}
            <CompareBottomCtas slug={page.slug} />
            <div className="flex flex-wrap gap-3 text-xs">
              <Link className="text-cyan-400 hover:underline" href="/compare">
                Back to compare
              </Link>
              <Link className="text-cyan-400 hover:underline" href="/how-scoring-works">
                How scoring works
              </Link>
              <Link className="text-cyan-400 hover:underline" href="/use-cases">
                Use cases
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingPage>
  )
}

