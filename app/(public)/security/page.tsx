import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Security | LeadIntel',
  description:
    'How LeadIntel handles authentication, billing, access controls, rate limiting, logging, and data handling.',
  openGraph: {
    title: 'Security | LeadIntel',
    description:
      'How LeadIntel handles authentication, billing, access controls, rate limiting, logging, and data handling.',
    url: 'https://dazrael.com/security',
  },
}

const SUPPORT_EMAIL = 'leadintel@dazrael.com'

export default function SecurityPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Security')}`

  return (
    <MarketingPage
      title="Security"
      subtitle="Plain-English overview of how LeadIntel is designed to protect your account and data."
    >
      <PageViewTrack event="trust_page_view" props={{ page: 'security' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              LeadIntel is built to help outbound sellers act on timely signals. We store the minimum needed to run the
              service and keep sensitive secrets server-side.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium text-foreground">We store</span>: your account email, billing/customer IDs,
                your saved ICP settings, and the accounts/leads you add to your watchlist.
              </li>
              <li>
                <span className="font-medium text-foreground">We do not store</span>: your Stripe payment card details
                (handled by Stripe), or your passwords in plaintext (handled via Supabase auth).
              </li>
            </ul>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Authentication</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>
                <span className="font-medium text-foreground">Provider:</span> Supabase (email/password sessions)
              </div>
              <div>
                <span className="font-medium text-foreground">Access control:</span> row-level policies in the database
                enforce tenant isolation.
              </div>
              <div>
                <span className="font-medium text-foreground">Session handling:</span> server routes avoid exposing secrets
                to the browser.
              </div>
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Billing</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div>
                <span className="font-medium text-foreground">Provider:</span> Stripe
              </div>
              <div>
                <span className="font-medium text-foreground">Customer portal:</span> users manage/cancel subscriptions via
                Stripe’s portal.
              </div>
              <div>
                <span className="font-medium text-foreground">Payment data:</span> payment method details are processed and
                stored by Stripe.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Platform safeguards</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium text-foreground">Rate limiting</span> is applied to public and authenticated
                endpoints to reduce abuse.
              </li>
              <li>
                <span className="font-medium text-foreground">Structured API responses</span> reduce accidental leakage of
                internal errors to clients.
              </li>
              <li>
                <span className="font-medium text-foreground">Logging</span> is structured and avoids printing secrets or
                full request bodies.
              </li>
              <li>
                <span className="font-medium text-foreground">Secrets</span> (API keys, service-role keys) are server-only
                environment variables.
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Data handling</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              We retain your workspace data for as long as your account is active, and we support deletion requests.
            </p>
            <p>
              To request deletion or export, email{' '}
              <a className="text-cyan-400 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
            <p>
              Backups and operational logs may be retained for a limited period to support reliability and incident
              response.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Vulnerability disclosure</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>
              If you believe you’ve found a security issue, email us at{' '}
              <a className="text-cyan-400 hover:underline" href={mailto}>
                {SUPPORT_EMAIL}
              </a>{' '}
              with the subject “Security”.
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Please include steps to reproduce and any relevant screenshots/logs.</li>
              <li>Please avoid scanning or disrupting other customers’ data.</li>
              <li>We’ll acknowledge reports and work toward a fix as quickly as possible.</li>
            </ul>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/#try-sample">Try a sample digest</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/subprocessors">View subprocessors</Link>
          </Button>
        </div>
      </div>
    </MarketingPage>
  )
}

