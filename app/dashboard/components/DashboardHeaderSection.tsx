'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, DollarSign, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { SignOutButton } from '@/components/SignOutButton'
import { usePlan } from '@/components/PlanProvider'
import { getDisplayPlanMeta } from '@/lib/billing/plan'
import { createClient } from '@/lib/supabase/client'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { useStripePortal } from '../hooks/useStripePortal'
import { ThemeToggle } from '@/components/ThemeToggle'
import { HouseCloserBadge } from './HouseCloserBadge'
import { BuildDebugPanel } from './BuildDebugPanel'
import { tierLabel as formatTierLabel, type Tier } from '@/lib/billing/tier'

interface DashboardHeaderSectionProps {
  isPro: boolean
  creditsRemaining: number
}

export function DashboardHeaderSection({ isPro, creditsRemaining }: DashboardHeaderSectionProps) {
  const router = useRouter()
  const { openPortal } = useStripePortal()
  const [isPending, startTransition] = useTransition()
  const { tier, isHouseCloserOverride, buildInfo, plan, planId } = usePlan()
  const planMeta = getDisplayPlanMeta({ tier })
  const isStarter = planMeta.tier === 'starter'
  const isCloser = planMeta.tier === 'closer'
  const isPaid = !isStarter
  const showHouseBadge = isCloser && Boolean(isHouseCloserOverride)
  const supabase = useMemo(() => createClient(), [])
  const [username, setUsername] = useState<string>('Account')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const user = await getUserSafe(supabase)
      if (cancelled) return
      const display =
        (typeof user?.user_metadata?.full_name === 'string' && user.user_metadata.full_name.trim()) ||
        (typeof user?.user_metadata?.name === 'string' && user.user_metadata.name.trim()) ||
        (typeof user?.email === 'string' && user.email.trim()) ||
        (typeof user?.phone === 'string' && user.phone.trim()) ||
        'Account'
      setUsername(display)
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [supabase])

  const handleManageBilling = () => {
    startTransition(async () => {
      try {
        await openPortal()
      } catch (err) {
        console.error('Error creating billing portal session', err)
      }
    })
  }

  return (
    <header className="border-b border-cyan-500/20 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">LEADINTEL</h1>
            <p className="text-sm text-muted-foreground mt-0.5">PROFESSIONAL TERMINAL</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Credits Display */}
            <Card className="border-cyan-500/20 bg-card/50 px-4 py-2">
              <div className="flex items-center gap-3">
                <CreditCard className="h-4 w-4 text-cyan-400" />
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Credits</p>
                  <p className="text-sm font-bold neon-cyan">
                    {planMeta.creditsLabel}
                  </p>
                </div>
              </div>
            </Card>

            {/* Subscription Badge */}
            <div className="flex items-center gap-2">
              <Badge
                variant={isStarter ? 'outline' : 'default'}
                className={
                  isStarter
                    ? 'border-slate-700/70 bg-slate-900/70 text-slate-100'
                    : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                }
              >
                <Shield className="h-3 w-3 mr-1" />
                {username} — {formatTierLabel(planMeta.tier as Tier)}
              </Badge>
              {showHouseBadge ? <HouseCloserBadge /> : null}
            </div>

            {/* Upgrade / Billing CTAs */}
            {isStarter ? (
              <div className="flex flex-col items-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => router.push('/pricing?target=closer')}
                  className="neon-border hover:glow-effect"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Upgrade to Closer
                </Button>
                <div className="max-w-[240px] text-right">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Upgrade unlocks
                  </div>
                  <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                    <li>Unlimited competitive reports</li>
                    <li>Full report details (competitor moves, trigger sources)</li>
                    <li>Saved report history in one place</li>
                    <li>Pro market watchlists &amp; alerts</li>
                  </ul>
                </div>
              </div>
            ) : (
              <>
                {planMeta.tier === 'closer' ? (
                  <Button
                    variant="outline"
                    onClick={() => router.push('/pricing?target=closer_plus')}
                    className="neon-border hover:glow-effect"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Upgrade to Closer+
                  </Button>
                ) : planMeta.tier === 'closer_plus' ? (
                  <Button
                    variant="outline"
                    onClick={() => router.push('/pricing?target=team')}
                    className="neon-border hover:glow-effect"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Upgrade to Team
                  </Button>
                ) : null}

                {isPaid ? (
                  <Button
                    variant="outline"
                    onClick={handleManageBilling}
                    disabled={isPending}
                    className="neon-border hover:glow-effect"
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Manage billing
                  </Button>
                ) : null}
              </>
            )}
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <BuildDebugPanel
            tier={tier}
            isHouseCloserOverride={Boolean(isHouseCloserOverride)}
            buildInfo={buildInfo}
            plan={plan}
            planId={planId}
          />
        </div>
      </div>
    </header>
  )
}
