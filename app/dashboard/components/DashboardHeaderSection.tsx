'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DollarSign, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { usePlan } from '@/components/PlanProvider'
import { getDisplayPlanMeta } from '@/lib/billing/plan'
import { createClient } from '@/lib/supabase/client'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { useStripePortal } from '../hooks/useStripePortal'
import { HouseCloserBadge } from './HouseCloserBadge'
import { BuildDebugPanel } from './BuildDebugPanel'
import { tierLabel as formatTierLabel, type Tier } from '@/lib/billing/tier'
import { track } from '@/lib/analytics'

interface DashboardHeaderSectionProps {
  creditsRemaining: number
}

export function DashboardHeaderSection({ creditsRemaining }: DashboardHeaderSectionProps) {
  const router = useRouter()
  const { openPortal } = useStripePortal()
  const [isPending, startTransition] = useTransition()
  const { tier, isHouseCloserOverride, isQaTierOverride, qaOverride, buildInfo, plan, planId } = usePlan()
  const planMeta = getDisplayPlanMeta({ tier })
  const isStarter = planMeta.tier === 'starter'
  const isCloser = planMeta.tier === 'closer'
  const isPaid = !isStarter
  const showHouseBadge = isCloser && Boolean(isHouseCloserOverride)
  const showQaBadge = Boolean(isQaTierOverride && qaOverride)
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
        track('billing_portal_clicked', { surface: 'dashboard_header', tier })
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
            {/* Account summary (compact) */}
            <Card className="border-cyan-500/20 bg-card/50 px-4 py-2">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-lg border border-cyan-500/20 bg-cyan-500/10">
                  <Shield className="h-4 w-4 text-cyan-300" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-semibold text-foreground">{username}</div>
                    <Badge
                      variant={isStarter ? 'outline' : 'default'}
                      className={
                        isStarter
                          ? 'border-slate-700/70 bg-slate-900/70 text-slate-100'
                          : 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                      }
                    >
                      {formatTierLabel(planMeta.tier as Tier)}
                    </Badge>
                    {showHouseBadge ? <HouseCloserBadge /> : null}
                    {showQaBadge ? (
                      <Badge variant="outline" className="border-purple-500/30 text-purple-300 bg-purple-500/10">
                        QA override
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {isStarter ? `Preview remaining: ${Math.max(0, creditsRemaining)}` : `Credits: ${planMeta.creditsLabel}`}
                  </div>
                </div>
              </div>
            </Card>

            {/* Upgrade / Billing CTAs */}
            {isStarter ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    track('dashboard_upgrade_clicked', { target: 'closer', surface: 'dashboard_header', tier })
                    router.push('/pricing?target=closer')
                  }}
                  className="w-full sm:w-auto min-h-10 neon-border hover:glow-effect"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Upgrade to Closer
                </Button>
              </>
            ) : (
              <>
                {planMeta.tier === 'closer' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      track('dashboard_upgrade_clicked', { target: 'closer_plus', surface: 'dashboard_header', tier })
                      router.push('/pricing?target=closer_plus')
                    }}
                    className="neon-border hover:glow-effect"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Upgrade to Closer+
                  </Button>
                ) : planMeta.tier === 'closer_plus' ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      track('dashboard_upgrade_clicked', { target: 'team', surface: 'dashboard_header', tier })
                      router.push('/pricing?target=team')
                    }}
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
                    className="w-full sm:w-auto min-h-10 neon-border hover:glow-effect"
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
              onClick={() => {
                track('dashboard_reports_clicked', { surface: 'dashboard_header', tier })
                router.push('/competitive-report')
              }}
              className="w-full sm:w-auto min-h-10 neon-border hover:glow-effect"
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
