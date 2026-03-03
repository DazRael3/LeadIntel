import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { MarketingPage } from '@/components/marketing/MarketingPage'
import { PageViewTrack } from '@/components/marketing/PageViewTrack'

export const metadata: Metadata = {
  title: 'Support | LeadIntel',
  description: 'Get help with billing, upgrades, and using LeadIntel.',
  openGraph: {
    title: 'Support | LeadIntel',
    description: 'Get help with billing, upgrades, and using LeadIntel.',
    url: 'https://dazrael.com/support',
    images: [
      {
        url: '/api/og?title=Support&subtitle=Trigger-based%20alerts%20%E2%86%92%20instant%20pitches',
        width: 1200,
        height: 630,
      },
    ],
  },
}

export default function SupportPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('LeadIntel Support')}`

  return (
    <MarketingPage title="Support" subtitle="Get help with billing, upgrades, and using LeadIntel.">
      <PageViewTrack event="support_page_view" props={{ page: 'support' }} />

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Email us at <span className="font-medium text-foreground">{SUPPORT_EMAIL}</span>.
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect">
                <a href={mailto}>Email support</a>
              </Button>
              <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                <Link href="/pricing">View pricing</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground">
              For the fastest help, include a screenshot and the URL you were on (no passwords or API keys).
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">FAQ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div>
              <div className="font-medium text-foreground">How do I manage or cancel my subscription?</div>
              <div className="mt-1">
                In the dashboard header, click <span className="font-medium text-foreground">Manage billing</span> to open the
                Stripe customer portal.
              </div>
            </div>
            <div>
              <div className="font-medium text-foreground">I upgraded, but the app still shows Starter.</div>
              <div className="mt-1">
                Refresh the page, then visit <span className="font-mono text-foreground">/api/plan</span> once. If it still
                shows Starter after a successful Stripe checkout, email support.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MarketingPage>
  )
}

