import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { JsonLd } from '@/components/seo/JsonLd'
import {
  LEAD_GENERATION_PAGES,
  getLeadGenerationPageBySlug,
  toNicheSegment,
} from '@/lib/seo/lead-generation-pages'

type Params = { niche: string }

export async function generateStaticParams(): Promise<Params[]> {
  return LEAD_GENERATION_PAGES.map((entry) => ({ niche: entry.slug }))
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { niche: rawNiche } = await params
  const normalized = toNicheSegment(rawNiche)
  const entry = getLeadGenerationPageBySlug(normalized)
  if (!entry) return {}
  const url = `https://raelinfo.com/ai-lead-generation-${entry.slug}`
  const title = `AI Lead Generation for ${entry.nicheLabel} | RaelInfo`

  return {
    title,
    description: entry.description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: entry.description,
      url,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent(`AI lead generation for ${entry.nicheLabel}`)}&subtitle=${encodeURIComponent(
            'Find high-intent accounts and generate outreach'
          )}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  }
}

export default async function LeadGenerationNichePage({ params }: { params: Promise<Params> }) {
  const { niche: rawNiche } = await params
  const normalized = toNicheSegment(rawNiche)
  const entry = getLeadGenerationPageBySlug(normalized)
  if (!entry) notFound()

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `AI lead generation for ${entry.nicheLabel}`,
    url: `https://raelinfo.com/ai-lead-generation-${entry.slug}`,
    description: entry.description,
    about: [
      { '@type': 'Thing', name: entry.nicheLabel },
      { '@type': 'SoftwareApplication', name: 'RaelInfo', url: 'https://raelinfo.com' },
    ],
  }

  return (
    <MarketingPage title={entry.headline} subtitle={entry.description}>
      <JsonLd data={jsonLd} />
      <PageViewTrack event="results_viewed" props={{ source: 'seo_niche_page', niche: entry.slug }} />

      <div className="grid gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-lg">How it works for {entry.nicheLabel}</CardTitle>
              <Badge variant="outline">AI lead generation</Badge>
            </div>
            <CardDescription>Turn your ICP and current signal intent into ready-to-run outreach.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              {entry.explanation.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div className="rounded border border-cyan-500/20 bg-cyan-500/10 p-3">
              <div className="font-medium text-foreground">Run the interactive demo</div>
              <p className="mt-1">
                See matched leads, why-now reasons, and AI outreach generated in one flow.
              </p>
              <div className="mt-3">
                <Button asChild className="neon-border hover:glow-effect">
                  <Link href="/demo">Start demo</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Explore more</CardTitle>
            <CardDescription>Internal paths for related onboarding and conversion flows.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 text-sm">
            <Link className="text-cyan-400 hover:underline" href="/demo">
              Demo
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/pricing">
              Pricing
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/use-cases">
              Use cases
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/templates">
              Templates
            </Link>
            <Link className="text-cyan-400 hover:underline" href="/compare">
              Compare alternatives
            </Link>
          </CardContent>
        </Card>
      </div>
    </MarketingPage>
  )
}
