import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { JsonLd } from '@/components/seo/JsonLd'
import { TemplatesLibraryClient, type Template } from '@/components/marketing/TemplatesLibraryClient'
import { VerticalTemplateRail } from '@/components/marketing/VerticalTemplateRail'
import { TEMPLATE_LIBRARY, TEMPLATE_TOKENS } from '@/lib/templates/registry'

export const metadata: Metadata = {
  title: 'Templates | LeadIntel',
  description: 'Copy/paste outreach templates you can adapt to your ICP and timing signals.',
  alternates: { canonical: 'https://dazrael.com/templates' },
  openGraph: {
    title: 'Templates | LeadIntel',
    description: 'Copy/paste outreach templates you can adapt to your ICP and timing signals.',
    url: 'https://dazrael.com/templates',
    images: [
      {
        url: '/api/og?title=Templates&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function TemplatesPage() {
  const templates: Template[] = TEMPLATE_LIBRARY.map((t) => ({
    id: t.id,
    slug: t.slug,
    channel: t.channel,
    trigger: t.trigger,
    persona: t.persona,
    length: t.length,
    title: t.title,
    subject: t.subject,
    body: t.body,
    notes: t.notes,
    tags: t.tags,
  }))

  const tokens = TEMPLATE_TOKENS.map((t) => ({ token: t.token, meaning: t.meaning, how: t.how }))

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Templates',
    url: 'https://dazrael.com/templates',
    description: 'Copy/paste outreach templates you can adapt to your ICP and timing signals.',
  }

  return (
    <MarketingPage title="Templates" subtitle="Copy/paste outreach templates you can adapt to your ICP and timing signals.">
      <JsonLd data={jsonLd} />
      <PageViewTrack event="templates_page_view" props={{ page: 'templates' }} />

      <VerticalTemplateRail />

      <TemplatesLibraryClient templates={templates} tokens={tokens} />

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <Button asChild className="neon-border hover:glow-effect">
          <Link href="/#try-sample">Generate a sample digest</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/pricing">See pricing</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/use-cases">Use cases</Link>
        </Button>
      </div>
    </MarketingPage>
  )
}

