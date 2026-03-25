'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, ListChecks } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { markUpgradeNudgeShown, shouldShowUpgradeNudge } from '@/lib/growth/nudge-cap'

type ActivationStepId = 'icp' | 'accounts_10' | 'first_pitch' | 'digest_cadence'

type ActivationEnvelope =
  | {
      ok: true
      data: {
        activation: {
          completedCount: number
          totalCount: number
          completed: boolean
          checklistCompletedAt: string | null
          steps: Array<{
            id: ActivationStepId
            title: string
            description: string
            completed: boolean
            meta?: Record<string, unknown>
          }>
          counts: { accounts: number; pitches: number }
        }
      }
    }
  | { ok: false; error?: { message?: string } }

const LS_HIDE_AFTER_COMPLETE = 'leadintel_checklist_hide_after_complete'
const LS_CELEBRATED_AT = 'leadintel_checklist_celebrated_at'

export function ActivationChecklistCard(props: {
  onOpenIcp: () => void
  onOpenAccounts: () => void
  onOpenDigestCadence: () => void
  onOpenPitch: () => void
  isStarter: boolean
}) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ActivationEnvelope | null>(null)
  const [show, setShow] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/activation', { cache: 'no-store' })
      const json = (await res.json()) as ActivationEnvelope
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    track('checklist_viewed', { location: 'dashboard' })
    void refresh()
  }, [refresh])

  const model = useMemo(() => {
    if (!data || data.ok !== true) return null
    return data.data.activation
  }, [data])

  useEffect(() => {
    if (!model) return
    if (!model.completed) return
    try {
      localStorage.setItem(LS_HIDE_AFTER_COMPLETE, '1')
      const celebratedAt = localStorage.getItem(LS_CELEBRATED_AT)
      if (!celebratedAt) {
        localStorage.setItem(LS_CELEBRATED_AT, new Date().toISOString())
        toast({
          title: 'Setup complete.',
          description: 'Your digest will prioritize accounts with trigger signals and draft outreach you can send fast.',
        })
        track('checklist_completed', { location: 'dashboard' })
        track('activation_completed', { location: 'dashboard' })
      }
    } catch {
      // ignore
    }
  }, [model, toast])

  useEffect(() => {
    if (!model) return
    if (!model.completed) {
      setShow(true)
      return
    }
    try {
      const hide = localStorage.getItem(LS_HIDE_AFTER_COMPLETE) === '1'
      setShow(!hide)
    } catch {
      setShow(false)
    }
  }, [model])

  if (loading && !model) {
    return (
      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Get to your first daily shortlist</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading checklist…</CardContent>
      </Card>
    )
  }

  if (!model) {
    return null
  }

  if (model.completed && !show) {
    return (
      <div className="space-y-3">
        <UpgradeInlineNudge show={props.isStarter} />
        <div className="flex items-center justify-between gap-3 rounded-lg border border-cyan-500/20 bg-card/40 px-4 py-3">
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-cyan-400" />
            Checklist hidden
          </div>
          <Button
            size="sm"
            variant="outline"
            className="neon-border hover:glow-effect"
            onClick={() => {
              try {
                localStorage.removeItem(LS_HIDE_AFTER_COMPLETE)
              } catch {
                // ignore
              }
              setShow(true)
            }}
          >
            Show checklist
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50" data-testid="activation-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Get to your first daily shortlist</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              Complete these steps to start trigger-based alerts and instant pitch drafts.
            </div>
          </div>
          <Badge variant="outline">
            {model.completedCount}/{model.totalCount} complete
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {model.steps.map((s) => (
          <div key={s.id} className="rounded-lg border border-cyan-500/10 bg-background/30 p-3" data-testid={`checklist-step-${s.id}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {s.completed ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div className="text-sm font-semibold text-foreground">{s.title}</div>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>
                {s.id === 'accounts_10' ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Accounts: {model.counts.accounts}/10
                  </div>
                ) : null}
              </div>

              {s.completed ? (
                <Badge variant="outline" className="text-green-400 border-green-500/30">
                  Done
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="neon-border hover:glow-effect shrink-0"
                  onClick={() => {
                    track('checklist_step_clicked', { stepId: s.id })
                    if (s.id === 'icp') props.onOpenIcp()
                    else if (s.id === 'accounts_10') props.onOpenAccounts()
                    else if (s.id === 'digest_cadence') props.onOpenDigestCadence()
                    else props.onOpenPitch()
                  }}
                  data-testid={`checklist-action-${s.id}`}
                >
                  {s.id === 'icp'
                    ? 'Set ICP'
                    : s.id === 'accounts_10'
                      ? 'Add accounts'
                      : s.id === 'digest_cadence'
                        ? 'Set cadence'
                        : 'Generate pitch'}
                </Button>
              )}
            </div>
          </div>
        ))}

        <UpgradeInlineNudge show={model.completed && props.isStarter} />

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              try {
                localStorage.setItem(LS_HIDE_AFTER_COMPLETE, '1')
              } catch {
                // ignore
              }
              setShow(false)
            }}
          >
            Hide
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function UpgradeInlineNudge(props: { show: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!props.show) {
      setVisible(false)
      return
    }
    const can = shouldShowUpgradeNudge({ key: 'upgrade_after_checklist', minHoursBetween: 24 })
    if (can) {
      setVisible(true)
      track('upgrade_nudge_viewed', { location: 'dashboard', reason: 'checklist_completed' })
      markUpgradeNudgeShown({ key: 'upgrade_after_checklist' })
      // Best-effort server-side record.
      void fetch('/api/settings/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_upgrade_nudge_shown_at: new Date().toISOString(), onboarding_completed: true }),
      }).catch(() => {})
    } else {
      setVisible(false)
    }
  }, [props.show])

  if (!visible) return null

  return (
    <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-foreground">Ready for daily outbound?</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Closer unlocks full digests, saved outputs, and richer context.
          </div>
        </div>
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => {
            setVisible(false)
            track('upgrade_nudge_dismissed', { location: 'dashboard' })
          }}
        >
          Not now
        </button>
      </div>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <Button
          size="sm"
          className="neon-border hover:glow-effect"
          onClick={() => {
            track('upgrade_nudge_clicked', { location: 'dashboard', reason: 'checklist_completed' })
            track('upgrade_clicked', { source: 'nudge', location: 'dashboard', reason: 'checklist_completed', target: 'closer' })
            window.location.href = '/pricing?target=closer'
          }}
        >
          Upgrade to Closer
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            track('upgrade_nudge_clicked', { location: 'dashboard', reason: 'checklist_completed_secondary' })
            track('upgrade_clicked', { source: 'nudge', location: 'dashboard', reason: 'checklist_completed_secondary' })
            window.location.href = '/pricing'
          }}
        >
          See pricing
        </Button>
      </div>
    </div>
  )
}

