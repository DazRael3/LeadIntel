import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { JsonLd } from '@/components/seo/JsonLd'
import { getTemplateBySlug, getTokenGlossaryForTemplate } from '@/lib/templates/registry'
import { TemplateDetailClient } from '@/components/marketing/TemplateDetailClient'

export function generateMetadata(props: { params: { slug: string } }): Metadata {
  const t = getTemplateBySlug(props.params.slug)
  if (!t) return {}
  const url = `https://dazrael.com/templates/${t.slug}`
  return {
    title: `${t.title} | LeadIntel Templates`,
    description: 'Copy/paste outreach template with evidence-based tokens and a clean “why now” angle.',
    alternates: { canonical: url },
    openGraph: {
      title: `${t.title} | LeadIntel Templates`,
      description: 'Copy/paste outreach template with evidence-based tokens and a clean “why now” angle.',
      url,
      images: [
        {
          url: `/api/og?title=${encodeURIComponent('Template')}&subtitle=${encodeURIComponent(t.title)}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  }
}

export default function TemplateDetailPage(props: { params: { slug: string } }) {
  const t = getTemplateBySlug(props.params.slug)
  if (!t) notFound()

  const glossary = getTokenGlossaryForTemplate(t)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t.title,
    url: `https://dazrael.com/templates/${t.slug}`,
    description: 'Copy/paste outreach template with evidence-based tokens and a clean “why now” angle.',
  }

  return (
    <MarketingPage title="Template" subtitle={t.title}>
      <JsonLd data={jsonLd} />
      <PageViewTrack event="template_detail_view" props={{ slug: t.slug, channel: t.channel, trigger: t.trigger }} />
      <TemplateDetailClient template={t} glossary={glossary} />
    </MarketingPage>
  )
}

