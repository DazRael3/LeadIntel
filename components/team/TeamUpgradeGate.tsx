import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { tierLabel, type Tier } from '@/lib/billing/tier'

export function TeamUpgradeGate(props: {
  heading?: string
  subtitle?: string
  whyLocked?: string
  bullets?: string[]
  primaryCtaHref?: string
  primaryCtaLabel?: string
  secondaryCtaHref?: string
  secondaryCtaLabel?: string
  continueCtaHref?: string
  continueCtaLabel?: string
  currentTier?: Tier
  sessionEmail?: string | null
  unlockPlanLabel?: string
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
  const continueCtaHref = props.continueCtaHref ?? '/dashboard'
  const continueCtaLabel = props.continueCtaLabel ?? 'Continue in Dashboard'
  const unlockPlanLabel = props.unlockPlanLabel ?? 'Team / Agency'
  const lockedOn = props.currentTier ? tierLabel(props.currentTier) : 'your current plan'
  const tierGuidance =
    !props.currentTier
      ? 'This workspace is on a non-Team tier. Team adds shared workflows, governance controls, and team-level operations.'
      : props.currentTier === 'closer_plus'
      ? 'You already have Closer+ for individual execution. Team adds shared approvals, governance controls, and team operations across reps.'
      : props.currentTier === 'closer'
      ? 'You have Closer-level execution features. Team adds shared workflows, governance, and multi-user operational controls.'
      : props.currentTier === 'team'
      ? 'Your account should already have Team access. If this lock persists, contact support.'
      : 'You are on Starter. Team unlocks shared workflows, governance controls, and team-level operations.'
  const isProUnlock = unlockPlanLabel.toLowerCase().includes('pro')

  return (
    <div className="min-h-screen bg-background terminal-grid">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <header className="max-w-2xl">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight bloomberg-font neon-cyan">{heading}</h1>
          <p className="mt-3 text-muted-foreground">{subtitle}</p>
        </header>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Locked on {lockedOn}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{whyLocked}</p>
            <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs">
              <div>
                <span className="font-medium text-foreground">Unlock plan:</span> {unlockPlanLabel}
              </div>
              <div className="mt-1">{tierGuidance}</div>
              {isProUnlock ? (
                <div className="mt-1">
                  Pro unlocks exports and campaign automation; Agency adds multi-workspace controls and advanced tracking.
                </div>
              ) : null}
            </div>
            {props.sessionEmail ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                Signed in as <span className="text-foreground">{props.sessionEmail}</span> · Effective tier{' '}
                <span className="text-foreground">{lockedOn}</span>
              </div>
            ) : null}
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
              <Button asChild variant="ghost">
                <Link href={continueCtaHref}>{continueCtaLabel}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

