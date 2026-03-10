'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckCircle2, Circle } from 'lucide-react'
import { track } from '@/lib/analytics'
import { useActivationV2 } from '@/components/dashboard/useActivationV2'
import { useExperiment } from '@/lib/experiments/useExperiment'

function stepHref(stepId: string): string {
  if (stepId === 'target_accounts_added') return '/onboarding'
  if (stepId === 'first_pitch_preview_generated') return '/pitch'
  if (stepId === 'first_report_preview_generated') return '/competitive-report/new'
  if (stepId === 'first_scoring_explainer_viewed') return '/how-scoring-works'
  if (stepId === 'templates_viewed') return '/templates'
  if (stepId === 'account_brief_saved') return '/dashboard'
  if (stepId === 'pricing_reviewed') return '/pricing'
  if (stepId === 'trust_reviewed') return '/trust'
  return '/dashboard'
}

function stepCta(stepId: string): string {
  if (stepId === 'target_accounts_added') return 'Continue onboarding'
  if (stepId === 'first_pitch_preview_generated') return 'Generate pitch'
  if (stepId === 'first_report_preview_generated') return 'Generate report'
  if (stepId === 'first_scoring_explainer_viewed') return 'Review scoring'
  if (stepId === 'templates_viewed') return 'Open templates'
  if (stepId === 'account_brief_saved') return 'Open workspace'
  if (stepId === 'pricing_reviewed') return 'View pricing'
  if (stepId === 'trust_reviewed') return 'Open trust center'
  return 'Open'
}

export function ActivationChecklist() {
  const { loading, model, refresh } = useActivationV2()
  const { assignment } = useExperiment({ experimentKey: 'dashboard_activation_copy_v1', surface: 'dashboard_activation' })
  const variant = assignment?.variantKey ?? 'control'

  useEffect(() => {
    track('dashboard_activation_checklist_viewed', { location: 'dashboard_command' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per mount
  }, [])

  if (loading && !model) {
    return (
      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activation</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">Loading activation…</CardContent>
      </Card>
    )
  }

  if (!model) return null

  return (
    <Card className="border-cyan-500/20 bg-card/50" data-testid="activation-checklist-v2">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Activation</CardTitle>
            <div className="mt-1 text-xs text-muted-foreground">
              {variant === 'direct'
                ? 'Run the loop: targets → why-now → draft → action.'
                : 'Make the workflow real: targets → why-now → drafts → action.'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {model.activation.completedCount}/{model.activation.totalCount} complete
            </Badge>
            <Button size="sm" variant="outline" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {model.activation.steps.map((s) => (
          <div key={s.id} className="rounded-lg border border-cyan-500/10 bg-background/30 p-3">
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
              </div>
              {s.completed ? (
                <Badge variant="outline" className="text-green-400 border-green-500/30">
                  Done
                </Badge>
              ) : (
                <Button asChild size="sm" variant="outline" className="neon-border hover:glow-effect shrink-0">
                  <Link
                    href={stepHref(s.id)}
                    onClick={() =>
                      track('checklist_step_clicked', {
                        stepId: s.id,
                        version: 'v2',
                        experimentKey: assignment?.experimentKey ?? null,
                        variantKey: assignment?.variantKey ?? null,
                        surface: 'dashboard_activation',
                      })
                    }
                  >
                    {stepCta(s.id)}
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

