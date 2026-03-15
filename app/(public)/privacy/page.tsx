import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { buildMailto } from '@/lib/mailto'

export const metadata: Metadata = {
  title: 'Privacy | LeadIntel',
  description: 'What LeadIntel collects, how it is used, and how to request access or deletion.',
  alternates: { canonical: 'https://dazrael.com/privacy' },
  openGraph: {
    title: 'Privacy | LeadIntel',
    description: 'What LeadIntel collects, how it is used, and how to request access or deletion.',
    url: 'https://dazrael.com/privacy',
    images: [
      {
        url: '/api/og?title=Privacy&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function PrivacyPage() {
  const mailto = buildMailto(SUPPORT_EMAIL, 'LeadIntel Privacy request')

  return (
    <MarketingPage title="Privacy" subtitle="What we collect, how we use it, and your choices.">
      <PageViewTrack event="trust_page_view" props={{ page: 'privacy' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">What we collect</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <span className="font-medium text-foreground">Account info</span>: email address and basic profile
                information you provide.
              </li>
              <li>
                <span className="font-medium text-foreground">Workspace content</span>: ICP settings and the accounts/leads
                you choose to monitor.
              </li>
              <li>
                <span className="font-medium text-foreground">Billing metadata</span>: Stripe customer and subscription IDs.
                Stripe processes payment method details.
              </li>
              <li>
                <span className="font-medium text-foreground">Usage analytics</span>: only if analytics is enabled in the
                environment (optional).
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Cookies</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              LeadIntel uses essential cookies for authentication/session management. Additional analytics cookies/events are
              used only when analytics is enabled.
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">How we use data</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide the service (digests, scoring, saved leads, reports).</li>
              <li>Operate billing and account management.</li>
              <li>Prevent abuse (rate limiting and security controls).</li>
              <li>Improve the product using aggregate usage signals (only if enabled).</li>
            </ul>
            <p>
              Legal bases may include performance of a contract (providing the service) and consent where applicable (e.g.,
              optional analytics).
            </p>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Sharing and subprocessors</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              We use a small set of subprocessors to provide infrastructure (authentication/database, billing). See the
              complete list on the Subprocessors page.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/subprocessors">View subprocessors</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Your rights</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              You can request access, export, or deletion by emailing{' '}
              <a className="text-cyan-400 hover:underline" href={mailto}>
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/#try-sample">Try a sample digest</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/support">Support</Link>
          </Button>
        </div>
      </div>
    </MarketingPage>
  )
}

