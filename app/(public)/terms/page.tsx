import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { buildMailto } from '@/lib/mailto'

export const metadata: Metadata = {
  title: 'Terms | LeadIntel',
  description: 'Terms of Service for LeadIntel.',
  alternates: { canonical: 'https://dazrael.com/terms' },
  openGraph: {
    title: 'Terms | LeadIntel',
    description: 'Terms of Service for LeadIntel.',
    url: 'https://dazrael.com/terms',
    images: [
      {
        url: '/api/og?title=Terms&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function TermsPage() {
  const supportMailto = buildMailto(SUPPORT_EMAIL, 'LeadIntel Terms')

  return (
    <MarketingPage title="Terms" subtitle="Service terms for using LeadIntel.">
      <PageViewTrack event="trust_page_view" props={{ page: 'terms' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">1) Scope of service</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              LeadIntel provides lead intelligence workflows including: saved account monitoring, scoring, and outreach
              templates. The service may evolve over time.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">2) Acceptable use</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              You agree to follow the Acceptable Use policy and not use the service for unlawful activity, abusive
              automation, or spam.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/acceptable-use">Read Acceptable Use</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">3) Billing, cancellation, and refunds</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              Paid plans are billed via Stripe. You can manage or cancel your subscription using the Stripe customer portal
              accessible from your dashboard.
            </p>
            <p>
              Unless required by law, fees are non-refundable and subscription access continues until the end of your billing
              period after cancellation.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">4) Disclaimers</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              LeadIntel provides signals and templates intended to help prioritize outbound work. Scores and signals are not a
              guarantee of outcomes or purchase intent.
            </p>
            <p>The service is provided “as is” without warranties of any kind.</p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">5) Limitation of liability</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              To the maximum extent permitted by law, LeadIntel will not be liable for indirect, incidental, special,
              consequential, or punitive damages, or for lost profits, revenue, or data.
            </p>
            <p>
              Liability for any claim is limited to the amount paid for the service in the 3 months preceding the event giving
              rise to the claim.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">6) Contact</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Questions about these terms? Email{' '}
              <a className="text-cyan-400 hover:underline" href={supportMailto}>
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

