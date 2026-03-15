import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function TeamUpgradeGate(props: {
  heading?: string
  subtitle?: string
  whyLocked?: string
  bullets?: string[]
  primaryCtaHref?: string
  primaryCtaLabel?: string
  secondaryCtaHref?: string
  secondaryCtaLabel?: string
} = {}) {
  const heading = props.heading ?? 'Team features'
  const subtitle =
    props.subtitle ?? 'Shared workflows, governance, and admin visibility across reps.'
  const whyLocked =
    props.whyLocked ?? 'This page is available on the Team plan to support shared execution and workspace governance.'
  const bullets = props.bullets ?? ['Shared templates and approvals', 'Team visibility and governance controls', 'Operational settings for rollouts and handoffs']
  const primaryCtaHref = props.primaryCtaHref ?? '/pricing?target=team'
  const primaryCtaLabel = props.primaryCtaLabel ?? 'Upgrade to Team'
  const secondaryCtaHref = props.secondaryCtaHref ?? '/pricing'
  const secondaryCtaLabel = props.secondaryCtaLabel ?? 'See pricing'

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <header className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bloomberg-font neon-cyan">{heading}</h1>
          <p className="mt-3 text-muted-foreground">{subtitle}</p>
        </header>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Locked on Starter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{whyLocked}</p>
            <ul className="list-disc pl-5 space-y-1">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="neon-border hover:glow-effect">
                <Link href={primaryCtaHref}>{primaryCtaLabel}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={secondaryCtaHref}>{secondaryCtaLabel}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

