'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'
import { useRouter } from 'next/navigation'
import { usePlan } from '@/components/PlanProvider'
import { useCallback, useMemo, useState } from 'react'

export function QuickTourActionsCard() {
  const router = useRouter()
  const { tier, capabilities } = usePlan()
  const [saving, setSaving] = useState(false)

  const canUseTourGoals = capabilities.tour_goals === true

  const goalLabel = useMemo(() => {
    // We store the goal server-side; this label is only used for the CTA copy,
    // and degrades safely if settings aren't available.
    return 'Choose tour goal'
  }, [])

  const persistGoal = useCallback(
    async (goal: 'pipeline' | 'conversion' | 'expansion') => {
      if (!canUseTourGoals) return
      setSaving(true)
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tour_goal: goal, tour_goal_selected_at: new Date().toISOString() }),
        })
      } catch {
        // fail-open: goal selection should never block navigation
      } finally {
        setSaving(false)
      }
    },
    [canUseTourGoals]
  )

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardContent className="py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-lg font-bold">Setup</div>
            <div className="text-sm text-muted-foreground">A tight loop: targets → why-now → drafts → action.</div>
          </div>
          <Badge variant="outline">{tier === 'starter' ? 'Starter tour' : 'Tour targets'}</Badge>
        </div>

        <div className="flex flex-col gap-3">
          {canUseTourGoals ? (
            <div className="rounded-lg border border-cyan-500/10 bg-background/30 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{goalLabel}</div>
                <Badge variant="outline" className="text-[11px]">
                  1-click
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Pick a goal to personalize your onboarding copy and suggested next actions. You can change it later.
              </div>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="neon-border hover:glow-effect"
                  disabled={saving}
                  onClick={() => {
                    track('tour_goal_selected', { goal: 'pipeline', source: 'dashboard_setup' })
                    void persistGoal('pipeline').then(() => router.push('/onboarding?step=2'))
                  }}
                >
                  Pipeline
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="neon-border hover:glow-effect"
                  disabled={saving}
                  onClick={() => {
                    track('tour_goal_selected', { goal: 'conversion', source: 'dashboard_setup' })
                    void persistGoal('conversion').then(() => router.push('/onboarding?step=2'))
                  }}
                >
                  Conversion
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="neon-border hover:glow-effect"
                  disabled={saving}
                  onClick={() => {
                    track('tour_goal_selected', { goal: 'expansion', source: 'dashboard_setup' })
                    void persistGoal('expansion').then(() => router.push('/onboarding?step=2'))
                  }}
                >
                  Expansion
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={saving}
                  onClick={() => {
                    track('tour_goal_skipped', { source: 'dashboard_setup' })
                    router.push('/onboarding?step=1')
                  }}
                >
                  Skip
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="neon-border hover:glow-effect"
              data-tour="tour-set-icp"
              onClick={() => {
                track('onboarding_started', { source: 'dashboard_setup', step: 1 })
                router.push('/onboarding?step=1')
              }}
            >
              Choose goal
            </Button>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            className="neon-border hover:glow-effect"
            data-tour="tour-add-accounts"
            onClick={() => {
              track('onboarding_cta_clicked', { source: 'dashboard_setup', step: 2 })
              router.push('/onboarding?step=2')
            }}
          >
            Add targets
          </Button>
          <Button
            variant="outline"
            className="neon-border hover:glow-effect"
            data-tour="tour-digest-cadence"
            onClick={() => {
              track('onboarding_cta_clicked', { source: 'dashboard_setup', step: 3 })
              router.push('/onboarding?step=3')
            }}
          >
            Pick workflow
          </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          You can come back and edit these anytime.
        </div>
      </CardContent>
    </Card>
  )
}

