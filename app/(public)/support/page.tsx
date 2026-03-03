import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Support | LeadIntel',
  description: 'Get help with billing, upgrades, and using LeadIntel.',
  openGraph: {
    title: 'Support | LeadIntel',
    description: 'Get help with billing, upgrades, and using LeadIntel.',
    url: 'https://dazrael.com/support',
  },
}

export default function SupportPage() {
  const supportEmail = 'leadintel@dazrael.com'
  const mailto = `mailto:${supportEmail}?subject=${encodeURIComponent('LeadIntel Support')}`

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto px-6 py-12 space-y-8">
        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold bloomberg-font neon-cyan">Support</h1>
          <p className="mt-2 text-muted-foreground">
            If you hit an issue during checkout, upgrades, or report generation, we’ll help you get unblocked quickly.
          </p>
        </div>

        <Card className="border-cyan-500/20 bg-card/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Email us at <span className="font-medium text-foreground">{supportEmail}</span>.
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
    </div>
  )
}

