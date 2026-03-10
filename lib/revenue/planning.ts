import type { AccountExplainability } from '@/lib/data/getAccountExplainability'
import type { AccountPlan, AccountPlanTimelineStep } from '@/lib/revenue/types'
import { deriveRevenueConfidence } from '@/lib/revenue/confidence'
import { observedVsInferredSignals, planningReasonSummary } from '@/lib/revenue/explanations'

export function buildStakeholderPath(ex: AccountExplainability): Array<{ persona: string; why: string; limitations: string[] }> {
  const out: Array<{ persona: string; why: string; limitations: string[] }> = []
  const items = ex.people.personas.items ?? []
  for (const p of items.slice(0, 3)) {
    out.push({
      persona: p.persona,
      why: p.whyNowAngle,
      limitations: p.limitations ?? [],
    })
  }
  if (out.length === 0 && ex.people.personas.topPersonas.length > 0) {
    out.push({
      persona: ex.people.personas.topPersonas[0]!,
      why: 'Suggested persona based on observed signal families.',
      limitations: ex.people.personas.confidence === 'limited' ? ['Persona evidence is limited; verify owner quickly.'] : [],
    })
  }
  return out
}

export function buildTimeline(ex: AccountExplainability): AccountPlanTimelineStep[] {
  const steps: AccountPlanTimelineStep[] = []

  const persona = ex.people.personas.topPersonas?.[0] ?? null
  if (ex.firstPartyIntent.summary.label !== 'none' || ex.momentum.label === 'rising') {
    steps.push({
      when: 'now',
      label: 'Send a crisp first touch',
      rationale: 'Timing is active; keep the ask narrow and route to the right owner quickly.',
      persona,
      caution: ex.dataQuality.quality === 'limited' ? 'Evidence is limited—verify context first.' : null,
    })
    steps.push({
      when: 'next',
      label: 'Prepare a handoff package',
      rationale: 'Package why-now context so downstream execution stays consistent.',
      persona: null,
      caution: null,
    })
    steps.push({
      when: 'later',
      label: 'Escalate to review if blocked',
      rationale: 'If delivery or approvals block progress, request manager review rather than stalling.',
      persona: null,
      caution: null,
    })
    return steps
  }

  if (ex.momentum.label === 'cooling' || ex.dataQuality.freshness === 'stale') {
    steps.push({
      when: 'wait',
      label: 'Monitor for stronger timing',
      rationale: 'Signals are cooling or stale; avoid forcing outreach.',
      persona: null,
      caution: 'Consider refreshing sources or waiting for a new signal.',
    })
    return steps
  }

  steps.push({
    when: 'now',
    label: 'Review signals and pick one angle',
    rationale: 'Evidence is steady; choose one grounded angle and test it.',
    persona,
    caution: ex.dataQuality.quality === 'limited' ? 'Evidence is thin—start broad and verify owner.' : null,
  })
  steps.push({
    when: 'next',
    label: 'Generate variants if needed',
    rationale: 'If the first touch lands, generate persona variants to follow up.',
    persona,
    caution: null,
  })
  return steps
}

export function buildAccountPlan(args: { workspaceId: string; accountId: string; window: AccountExplainability['sourceHealth']['window']; ex: AccountExplainability }): AccountPlan {
  const { label, limitationsNote } = deriveRevenueConfidence(args.ex)
  const computedAt = new Date().toISOString()
  const whatWouldMakeThisStronger: string[] = []

  if (args.ex.dataQuality.quality === 'limited') whatWouldMakeThisStronger.push('More supporting signals (coverage) for this account.')
  if (args.ex.firstPartyIntent.summary.label === 'none') whatWouldMakeThisStronger.push('A first-party match (if applicable) to validate active evaluation.')
  if (args.ex.momentum.label !== 'rising') whatWouldMakeThisStronger.push('A fresher high-impact signal to tighten timing.')

  return {
    type: 'account_plan',
    workspaceId: args.workspaceId,
    accountId: args.accountId,
    window: args.window,
    version: 'plan_v1',
    computedAt,
    confidence: label,
    reasonSummary: planningReasonSummary(args.ex),
    signals: observedVsInferredSignals(args.ex),
    limitationsNote,
    quality: { dataQuality: args.ex.dataQuality.quality, freshness: args.ex.dataQuality.freshness },
    stakeholderPath: buildStakeholderPath(args.ex),
    timeline: buildTimeline(args.ex),
    whatWouldMakeThisStronger,
  }
}

