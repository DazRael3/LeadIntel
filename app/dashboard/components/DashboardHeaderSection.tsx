'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CreditCard, DollarSign, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePlan } from '@/components/PlanProvider'
import { getDisplayPlanMeta } from '@/lib/billing/plan'
import { createClient } from '@/lib/supabase/client'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { useStripePortal } from '../hooks/useStripePortal'
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
    <header className="border-b border-cyan-500/20 bg-background/80 backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-6 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold bloomberg-font neon-cyan">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Why-now signals → explainable score → send-ready outreach</p>
          </div>
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center lg:gap-3">
            {/* Account badge */}
            <div className="flex flex-wrap items-center gap-2">
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
              <div className="flex flex-wrap items-center gap-3">
                <Card className="border-cyan-500/20 bg-card/50 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-cyan-300" />
                    <div>
                      <p className="text-xs text-muted-foreground">Preview remaining</p>
                      <p className="text-sm font-semibold text-foreground">{Math.max(0, creditsRemaining)}</p>
                    </div>
                  </div>
                </Card>
                <Button
                  variant="outline"
                  onClick={() => router.push('/pricing?target=closer')}
                  className="neon-border hover:glow-effect"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Upgrade to Closer
                </Button>
                <details className="w-full lg:w-auto lg:max-w-[280px] rounded border border-cyan-500/10 bg-background/40 p-3">
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    What upgrading unlocks
                  </summary>
                  <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <li>Unlimited competitive reports</li>
                    <li>Full report details (competitor moves, trigger sources)</li>
                    <li>Saved report history in one place</li>
                    <li>Market watchlists &amp; alerts</li>
                  </ul>
                </details>
              </div>
            ) : (
              <>
                <Card className="border-cyan-500/20 bg-card/50 px-4 py-2">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-4 w-4 text-cyan-300" />
                    <div>
                      <p className="text-xs text-muted-foreground">Credits</p>
                      <p className="text-sm font-semibold text-foreground">{planMeta.creditsLabel}</p>
                    </div>
                  </div>
                </Card>
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/competitive-report')}
              className="neon-border hover:glow-effect"
              data-testid="dashboard-reports-button"
            >
              Reports
            </Button>
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
