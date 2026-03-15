import type { Metadata } from 'next'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Subprocessors | LeadIntel',
  description: 'Infrastructure providers used to operate LeadIntel.',
  alternates: { canonical: 'https://dazrael.com/subprocessors' },
  openGraph: {
    title: 'Subprocessors | LeadIntel',
    description: 'Infrastructure providers used to operate LeadIntel.',
    url: 'https://dazrael.com/subprocessors',
  },
}

type Subprocessor = {
  name: string
  website: string
  purpose: string
  data: string
  condition?: string
}

export default function SubprocessorsPage() {
  const list: Subprocessor[] = [
    {
      name: 'Supabase',
      website: 'https://supabase.com',
      purpose: 'Authentication and database hosting',
      data: 'Account identifiers, workspace data (ICP/leads), and operational metadata',
    },
    {
      name: 'Stripe',
      website: 'https://stripe.com',
      purpose: 'Subscription billing and customer portal',
      data: 'Billing customer and subscription metadata (payment method details handled by Stripe)',
    },
    {
      name: 'Resend',
      website: 'https://resend.com',
      purpose: 'Transactional email delivery (e.g., digests) when enabled',
      data: 'Recipient email address and email content for delivery',
      condition: 'Only used when email features are enabled/configured.',
    },
    {
      name: 'PostHog',
      website: 'https://posthog.com',
      purpose: 'Product analytics when enabled',
      data: 'Event names and limited event properties (no secrets)',
      condition: 'Only used when analytics is enabled/configured.',
    },
    {
      name: 'Sentry',
      website: 'https://sentry.io',
      purpose: 'Error monitoring when enabled',
      data: 'Error metadata and request IDs (PII minimized)',
      condition: 'Only used when Sentry is enabled/configured.',
    },
  ]

  return (
    <MarketingPage title="Subprocessors" subtitle="Third-party providers used to operate LeadIntel.">
      <PageViewTrack event="trust_page_view" props={{ page: 'subprocessors' }} />

      <div className="grid grid-cols-1 gap-6">
        {list.map((s) => (
          <Card key={s.name} className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{s.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>
                <span className="font-medium text-foreground">Website:</span>{' '}
                <a className="text-cyan-400 hover:underline" href={s.website} target="_blank" rel="noreferrer">
                  {s.website}
                </a>
              </div>
              <div>
                <span className="font-medium text-foreground">Purpose:</span> {s.purpose}
              </div>
              <div>
                <span className="font-medium text-foreground">Data processed:</span> {s.data}
              </div>
              {s.condition ? <div className="text-xs text-muted-foreground">{s.condition}</div> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </MarketingPage>
  )
}

