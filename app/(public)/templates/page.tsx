import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { JsonLd } from '@/components/seo/JsonLd'
import { TemplatesLibraryClient, type Template } from '@/components/marketing/TemplatesLibraryClient'

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
  const templates: Template[] = [
    {
      id: 'email-why-now-short',
      channel: 'email',
      title: 'Short “why now” opener',
      tags: ['short', 'timing'],
      body:
        'Subject: Quick question re: {{trigger}}\n\nSaw {{trigger}} at {{company}}.\n\nIs {{initiative}} a priority in the next {{timeframe}}?\n\nIf yes, I can share a 2-minute idea on how teams like yours handle {{pain}} without adding process overhead.\n\nWorth 10 minutes?',
    },
    {
      id: 'email-owner-handoff',
      channel: 'email',
      title: 'Owner check + handoff',
      tags: ['routing', 'owner'],
      body:
        'Subject: Are you the right owner?\n\nQuick question — who owns {{workflow}} at {{company}}?\n\nI’m reaching out because {{trigger}} usually creates a timing window for {{initiative}}.\n\nIf it’s you, I’ll send a tight 3-bullet idea. If not, who should I ask?',
    },
    {
      id: 'email-breakup-calm',
      channel: 'email',
      title: 'Breakup (calm)',
      tags: ['breakup'],
      body:
        'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf {{initiative}} isn’t a priority right now, no problem — I can reach back out when timing changes.',
    },
    {
      id: 'li-ultra-short',
      channel: 'linkedin',
      title: 'Ultra short question',
      tags: ['ultra-short'],
      body: 'Quick question: is {{initiative}} a priority right now at {{company}}?',
    },
    {
      id: 'li-value-question',
      channel: 'linkedin',
      title: 'Value + question',
      tags: ['value'],
      body:
        'Saw {{trigger}} at {{company}}.\n\nIf you’re working on {{initiative}}, I can share a short checklist for turning “why now” signals into a daily shortlist + a send-ready draft.\n\nWant it?',
    },
    {
      id: 'call-opener-timing-window',
      channel: 'call',
      title: 'Opener: timing window',
      tags: ['timing'],
      body:
        'Hey {{name}} — quick question. I saw {{trigger}} at {{company}}. Is {{initiative}} a priority in the next {{timeframe}}, or is focus elsewhere?',
    },
    {
      id: 'call-opener-owner-mapping',
      channel: 'call',
      title: 'Opener: owner mapping',
      tags: ['owner'],
      body:
        'Hi {{name}} — who owns {{workflow}} at {{company}}? I’m reaching out because {{trigger}} usually changes priorities and I want to make sure I’m talking to the right person.',
    },
    {
      id: 'email-pilot-week-1',
      channel: 'email',
      title: 'Pilot offer (week 1)',
      tags: ['pilot', 'week-1'],
      body:
        'Subject: Small pilot idea\n\nIf you’re open to it, here’s a simple pilot:\n- define ICP\n- add 10–25 target accounts\n- review a daily shortlist for 5 days\n- compare outcomes (replies/meetings) vs your baseline\n\nIf you want, I can send a one-page outline.',
    },
  ]

  const tokens = [
    { token: '{{company}}', meaning: 'Target account', how: 'Company name (or domain if you prefer).' },
    { token: '{{trigger}}', meaning: 'Why now signal', how: 'Funding, hiring spike, partnership, product launch, renewal window.' },
    { token: '{{initiative}}', meaning: 'Likely priority', how: 'Pipeline coverage, enablement, reporting, security, expansion.' },
    { token: '{{timeframe}}', meaning: 'Decision window', how: '“30 days”, “this quarter”, “next 60 days”.' },
    { token: '{{pain}}', meaning: 'Concrete pain', how: 'One specific pain tied to the initiative (handoffs, drift, missing context).' },
    { token: '{{workflow}}', meaning: 'Workflow owned', how: 'Routing, enablement, outbound execution, reporting.' },
    { token: '{{name}}', meaning: 'Contact first name', how: 'First name only.' },
  ]

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

