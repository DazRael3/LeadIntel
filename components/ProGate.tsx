'use client'

import { type ReactNode } from 'react'
import { usePlan } from '@/components/PlanProvider'
import { Button } from '@/components/ui/button'
import { Lock, DollarSign } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { COPY } from '@/lib/copy/leadintel'

type Tier = 'starter' | 'closer' | 'closer_plus' | 'team'
type RequiredTier = Exclude<Tier, 'starter'>
type UpgradeTarget = RequiredTier

function tierAtLeast(tier: Tier, required: RequiredTier): boolean {
  const rank = (t: Tier): number => {
    switch (t) {
      case 'starter':
        return 0
      case 'closer':
        return 1
      case 'closer_plus':
        return 2
      case 'team':
        return 3
    }
  }
  return rank(tier) >= rank(required)
}

function tierLabel(tier: RequiredTier): string {
  switch (tier) {
    case 'closer':
      return 'Closer'
    case 'closer_plus':
      return 'Closer+'
    case 'team':
      return 'Team'
  }
}

export function ProGate(props: {
  children: ReactNode
  requiredTier: RequiredTier
  upgradeTarget?: UpgradeTarget
  /** Optional: choose a feature-specific gate variant */
  variant?: 'general' | 'moreAccounts' | 'savedOutputs' | 'advancedSignals'
  /** Whether to show benefit bullets (default: true) */
  showBenefits?: boolean
  /** Back-compat; ignored in unified copy mode */
  label?: string
  /** Back-compat; ignored in unified copy mode */
  description?: string
}) {
  const { tier } = usePlan()
  const router = useRouter()
  const upgradeTarget = props.upgradeTarget ?? props.requiredTier
  const allowed = tierAtLeast(tier, props.requiredTier)

  if (allowed) return <>{props.children}</>

  const ctaHref = `/pricing?target=${upgradeTarget}`
  const showBenefits = props.showBenefits ?? true
  const variant = props.variant ?? 'general'

  const variantTitle =
    variant === 'moreAccounts'
      ? COPY.gates.variants.moreAccounts.title
      : variant === 'savedOutputs'
        ? COPY.gates.variants.savedOutputs.title
        : variant === 'advancedSignals'
          ? COPY.gates.variants.advancedSignals.title
          : COPY.gates.title

  const variantBody =
    variant === 'moreAccounts'
      ? COPY.gates.variants.moreAccounts.body
      : variant === 'savedOutputs'
        ? COPY.gates.variants.savedOutputs.body
        : variant === 'advancedSignals'
          ? COPY.gates.variants.advancedSignals.body
          : COPY.gates.body
  const continueHref = '/dashboard'

  return (
    <div className="relative">
      <div aria-hidden className="pointer-events-none select-none blur-[2px] opacity-50">
        {props.children}
      </div>
      <div className="absolute inset-0 z-10 flex items-center justify-center">
        <div className="w-full max-w-sm rounded-lg border border-purple-500/30 bg-background/85 backdrop-blur-sm p-4 text-center shadow-xl">
          <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full border border-purple-500/30 bg-purple-500/10">
            <Lock className="h-5 w-5 text-purple-300" />
          </div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{COPY.gates.label}</div>
          <div className="mt-1 text-sm font-semibold">{variantTitle}</div>
          <div className="mt-1 text-xs text-muted-foreground">{variantBody}</div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            Unlock path: {tierLabel(props.requiredTier)} or higher. Continue working in Dashboard if you are not upgrading yet.
          </div>
          {showBenefits ? (
            <ul className="mt-3 text-left text-xs text-muted-foreground list-disc pl-5 space-y-1">
              {COPY.gates.benefits.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-col sm:flex-row justify-center gap-2">
            <Button type="button" size="sm" className="neon-border hover:glow-effect" onClick={() => router.push(ctaHref)}>
              <DollarSign className="h-4 w-4 mr-2" />
              {COPY.gates.ctaPrimary}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => router.push('/pricing')}>
              {COPY.gates.ctaSecondary}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => router.push(continueHref)}>
              Continue in Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

