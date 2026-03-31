'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePlan } from '@/components/PlanProvider'
import { track } from '@/lib/analytics'

type GoalKey = 'pipeline' | 'conversion' | 'expansion'

type TourGoalEnvelope =
  | { ok: true; data: { enabledByTier: boolean; goal: GoalKey | null; selectedAt: string | null } }
  | { ok: false; error?: { message?: string } }

const GOALS: Array<{ key: GoalKey; label: string; helper: string }> = [
  { key: 'pipeline', label: 'Pipeline', helper: 'Prioritize net-new target accounts and fast first touches.' },
  { key: 'conversion', label: 'Conversion', helper: 'Tighten angles, objections, and next-step asks.' },
  { key: 'expansion', label: 'Expansion', helper: 'Focus on accounts showing momentum and change signals.' },
]

export function TourGoalsCard(props: { compact?: boolean }) {
  const { tier, capabilities } = usePlan()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [data, setData] = useState<TourGoalEnvelope | null>(null)

  const allowed = capabilities.tour_goals === true

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tour-goal', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as TourGoalEnvelope | null
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!allowed) return
    if (tier !== 'starter') return
    void refresh()
  }, [refresh, allowed, tier])

  const model = useMemo(() => (data && data.ok === true ? data.data : null), [data])
  const selected = model?.goal ?? null

  const choose = useCallback(
    async (goal: GoalKey) => {
      if (!allowed) return
      setSaving(true)
      try {
        const res = await fetch('/api/tour-goal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ goal }),
        })
        if (!res.ok) {
          track('tour_goal_select_failed', { goal, tier })
          return
        }
        track('tour_goal_selected', { goal, tier })
        await refresh()
      } finally {
        setSaving(false)
      }
    },
    [refresh, tier, allowed]
  )

  const canShow = allowed && tier === 'starter'
  if (!canShow) return null

  const title = selected ? `Tour goal: ${selected}` : 'Pick a tour goal'
  const helper = selected
    ? GOALS.find((g) => g.key === selected)?.helper ?? 'Your goal will personalize the onboarding path.'
    : 'Choose what you want LeadIntel to optimize for first. You can change this later.'

  return (
    <Card className="border-cyan-500/20 bg-card/50" data-testid="tour-goals-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
          </div>
          <Badge variant="outline">Starter</Badge>
        </div>
      </CardHeader>
      <CardContent className={props.compact ? 'space-y-2' : 'space-y-3'}>
        {loading && !model ? (
          <div className="text-sm text-muted-foreground">Loading goals…</div>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {GOALS.map((g) => {
              const active = selected === g.key
              return (
                <button
                  key={g.key}
                  type="button"
                  className={`text-left rounded-lg border p-3 transition ${
                    active ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-cyan-500/15 bg-background/30 hover:bg-background/50'
                  }`}
                  onClick={() => void choose(g.key)}
                  disabled={saving}
                >
                  <div className="text-sm font-semibold text-foreground">{g.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{g.helper}</div>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={saving || loading}>
            Refresh
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

