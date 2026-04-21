import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { buildMailto } from '@/lib/mailto'

export const metadata: Metadata = {
  title: 'DPA | LeadIntel',
  description: 'A lightweight data processing addendum summary for LeadIntel.',
  alternates: { canonical: 'https://raelinfo.com/dpa' },
  openGraph: {
    title: 'DPA | LeadIntel',
    description: 'A lightweight data processing addendum summary for LeadIntel.',
    url: 'https://raelinfo.com/dpa',
    images: [
      {
        url: '/api/og?title=DPA&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function DpaPage() {
  const mailto = buildMailto(SUPPORT_EMAIL, 'LeadIntel DPA request')

  return (
    <MarketingPage title="DPA" subtitle="Lightweight data processing addendum summary.">
      <PageViewTrack event="trust_page_view" props={{ page: 'dpa' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Roles</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              In general terms: you (the customer) act as the controller of your workspace data, and LeadIntel acts as a
              processor to provide the service.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Data types</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Account identifiers (email), workspace configuration (ICP), and saved leads/accounts.</li>
              <li>Billing identifiers (Stripe customer/subscription IDs).</li>
              <li>Optional usage analytics events when enabled.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Security measures</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <ul className="list-disc pl-5 space-y-1">
              <li>Access controls enforced in the database (tenant isolation).</li>
              <li>Server-side secrets handling (no client exposure of keys).</li>
              <li>Rate limiting and structured error handling.</li>
              <li>Optional monitoring with PII-minimizing defaults when enabled.</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Subprocessors</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>LeadIntel uses a small set of subprocessors for infrastructure and billing.</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/subprocessors">View subprocessors</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Requests</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              To request a signed copy or to ask questions, email{' '}
              <a className="text-cyan-400 hover:underline" href={mailto}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </MarketingPage>
  )
}

