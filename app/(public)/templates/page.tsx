import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { JsonLd } from '@/components/seo/JsonLd'

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

type Template = { channel: 'Email' | 'LinkedIn' | 'Call'; title: string; body: string; tags: string[] }

export default function TemplatesPage() {
  const templates: Template[] = [
    {
      channel: 'Email',
      title: 'Short “why now” opener',
      tags: ['short', 'timing'],
      body:
        'Subject: Quick question re: [TRIGGER]\n\nSaw [TRIGGER] at [COMPANY].\n\nIs [INITIATIVE] a priority in the next [TIMEFRAME]?\n\nIf yes, I can share a 2-minute idea on how teams like yours handle [PAIN] without adding process overhead.\n\nWorth 10 minutes?',
    },
    {
      channel: 'Email',
      title: 'Owner check + handoff',
      tags: ['routing', 'owner'],
      body:
        'Subject: Are you the right owner?\n\nQuick question — who owns [WORKFLOW] at [COMPANY]?\n\nI’m reaching out because [TRIGGER] usually creates a timing window for [INITIATIVE].\n\nIf it’s you, I’ll send a tight 3-bullet idea. If not, who should I ask?',
    },
    {
      channel: 'Email',
      title: 'Breakup (calm)',
      tags: ['breakup'],
      body:
        'Subject: Close the loop?\n\nShould I close the loop on this?\n\nIf [INITIATIVE] isn’t a priority right now, no problem — I can reach back out when timing changes.',
    },
    {
      channel: 'LinkedIn',
      title: 'Ultra short question',
      tags: ['ultra-short'],
      body: 'Quick question: is [INITIATIVE] a priority right now at [COMPANY]?',
    },
    {
      channel: 'LinkedIn',
      title: 'Value + question',
      tags: ['value'],
      body:
        'Saw [TRIGGER] at [COMPANY].\n\nIf you’re working on [INITIATIVE], I can share a short checklist for turning “why now” signals into a daily shortlist + a send-ready draft.\n\nWant it?',
    },
    {
      channel: 'Call',
      title: 'Opener: timing window',
      tags: ['timing'],
      body:
        'Hey [NAME] — quick question. I saw [TRIGGER] at [COMPANY]. Is [INITIATIVE] a priority in the next [TIMEFRAME], or is focus elsewhere?',
    },
    {
      channel: 'Call',
      title: 'Opener: owner mapping',
      tags: ['owner'],
      body:
        'Hi [NAME] — who owns [WORKFLOW] at [COMPANY]? I’m reaching out because [TRIGGER] usually changes priorities and I want to make sure I’m talking to the right person.',
    },
    {
      channel: 'Email',
      title: 'Pilot offer (week 1)',
      tags: ['pilot', 'week-1'],
      body:
        'Subject: Small pilot idea\n\nIf you’re open to it, here’s a simple pilot:\n- define ICP\n- add 10–25 target accounts\n- review a daily shortlist for 5 days\n- compare outcomes (replies/meetings) vs your baseline\n\nIf you want, I can send a one-page outline.',
    },
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

      <div className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <Card key={`${t.channel}-${t.title}`} className="border-cyan-500/20 bg-card/60">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">{t.title}</CardTitle>
                  <Badge variant="outline">{t.channel}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {t.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-muted-foreground">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground rounded border border-cyan-500/10 bg-background/40 p-4">
                  {t.body}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Personalization tokens</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium text-foreground">[TRIGGER]</span>: what changed (funding, hiring spike, partnership, product launch).
              </li>
              <li>
                <span className="font-medium text-foreground">[INITIATIVE]</span>: the likely initiative your ICP cares about (pipeline, enablement, reporting, security, expansion).
              </li>
              <li>
                <span className="font-medium text-foreground">[PAIN]</span>: one concrete pain tied to the initiative.
              </li>
              <li>
                <span className="font-medium text-foreground">[WORKFLOW]</span>: the workflow you influence (routing, enablement, outbound execution, reporting).
              </li>
              <li>
                <span className="font-medium text-foreground">[TIMEFRAME]</span>: “30 days”, “this quarter”, “next 60 days”.
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
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
      </div>
    </MarketingPage>
  )
}

