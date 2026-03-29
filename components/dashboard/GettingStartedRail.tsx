'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'
import { useActivationV2 } from '@/components/dashboard/useActivationV2'
import { useExperiment } from '@/lib/experiments/useExperiment'

function nextCta(stepId: string | null): { href: string; label: string; helper: string } {
  if (!stepId) return { href: '/dashboard', label: 'Open command center', helper: 'You’re ready to run the loop.' }
  if (stepId === 'target_accounts_added') return { href: '/onboarding', label: 'Add targets', helper: 'Start by tracking a few accounts.' }
  if (stepId === 'first_pitch_preview_generated') return { href: '/pitch', label: 'Generate a pitch preview', helper: 'Turn why-now signals into a send-ready opener.' }
  if (stepId === 'first_report_preview_generated') return { href: '/competitive-report?auto=1', label: 'Generate a report preview', helper: 'Create a sourced competitive report and save it.' }
  if (stepId === 'first_scoring_explainer_viewed') return { href: '/how-scoring-works', label: 'Review scoring method', helper: 'Understand what drives the 0–100 score.' }
  if (stepId === 'templates_viewed') return { href: '/templates', label: 'Open templates', helper: 'Stay consistent across reps and accounts.' }
  if (stepId === 'account_brief_saved') return { href: '/dashboard', label: 'Generate an account brief', helper: 'Use the account workspace action center to save a brief.' }
  if (stepId === 'pricing_reviewed') return { href: '/pricing', label: 'Review plans', helper: 'Move from preview to daily execution.' }
  if (stepId === 'trust_reviewed') return { href: '/trust', label: 'Open trust center', helper: 'Inspect policies before you buy.' }
  return { href: '/dashboard', label: 'Open command center', helper: 'Run the loop.' }
}

export function GettingStartedRail() {
  const { model } = useActivationV2()
  const { assignment } = useExperiment({ experimentKey: 'dashboard_getting_started_copy_v1', surface: 'dashboard_getting_started' })
  if (!model) return null

  const variant = assignment?.variantKey ?? 'control'

  const next = nextCta(model.activation.nextBestStep)
  const title = variant === 'direct' ? 'Next step' : 'Getting started'
  const badge = variant === 'direct' ? 'Recommended' : 'Next best step'

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="outline">{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <div className="text-sm text-muted-foreground">{next.helper}</div>
        <Button
          asChild
          size="sm"
          className="neon-border hover:glow-effect"
          onClick={() =>
            track('onboarding_started', {
              source: 'dashboard_getting_started',
              experimentKey: assignment?.experimentKey ?? null,
              variantKey: assignment?.variantKey ?? null,
              surface: 'dashboard_getting_started',
            })
          }
        >
          <Link href={next.href}>{next.label}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

