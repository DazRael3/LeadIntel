import type { SupabaseClient } from '@supabase/supabase-js'
import type { AccountExplainability } from '@/lib/data/getAccountExplainability'
import type { MultiTouchPlan, TouchPlanStep } from '@/lib/revenue/types'
import { deriveRevenueConfidence } from '@/lib/revenue/confidence'
import { observedVsInferredSignals, planningReasonSummary } from '@/lib/revenue/explanations'

function pickPersona(ex: AccountExplainability, idx: number): string | null {
  return ex.people.personas.topPersonas?.[idx] ?? null
}

export async function buildMultiTouchPlan(args: {
  supabase: SupabaseClient
  workspaceId: string
  accountId: string
  window: '7d' | '30d' | '90d' | 'all'
  ex: AccountExplainability
}): Promise<MultiTouchPlan> {
  const computedAt = new Date().toISOString()
  const conf = deriveRevenueConfidence(args.ex)

  const steps: TouchPlanStep[] = []
  const p1 = pickPersona(args.ex, 0)
  const p2 = pickPersona(args.ex, 1) ?? p1

  if (args.ex.dataQuality.quality === 'limited' || args.ex.dataQuality.freshness === 'stale') {
    steps.push({
      step: 'wait',
      label: 'Wait for a stronger signal',
      persona: null,
      rationale: 'Evidence quality is limited; avoid a spammy cadence.',
      caution: conf.limitationsNote ?? 'Evidence is thin.',
    })
  } else {
    steps.push({
      step: 'touch_1',
      label: 'First touch: timing-led question',
      persona: p1,
      rationale: 'Anchor on a single observed why-now cue and ask a routing/prioritization question.',
      caution: args.ex.firstPartyIntent.summary.label === 'none' ? 'No first-party match; timing is based on detected signals.' : null,
    })

    steps.push({
      step: 'touch_2',
      label: 'Second touch: value artifact + tight CTA',
      persona: p2,
      rationale: 'Offer a concrete artifact (checklist/workflow) tied to the same why-now.',
      caution: null,
    })

    steps.push({
      step: 'fallback',
      label: 'Fallback: route to the true owner',
      persona: null,
      rationale: 'If the persona is wrong, route quickly instead of continuing the cadence.',
      caution: 'Persona suggestions are heuristic; verify owner quickly.',
    })
  }

  const limitations = conf.limitationsNote
    ? `${conf.limitationsNote} Multi-touch plans are suggestions, not guaranteed sequences.`
    : 'Multi-touch plans are suggestions, not guaranteed sequences.'

  return {
    type: 'multi_touch_plan',
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    window: args.window,
    version: 'touch_v1',
    computedAt,
    confidence: conf.label,
    reasonSummary: planningReasonSummary(args.ex),
    signals: observedVsInferredSignals(args.ex),
    limitationsNote: limitations,
    steps,
  }
}

