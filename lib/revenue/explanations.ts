import type { AccountExplainability } from '@/lib/data/getAccountExplainability'
import type { PlanningSignal } from '@/lib/revenue/types'
import { formatSignalType } from '@/lib/domain/explainability'

export function observedVsInferredSignals(ex: AccountExplainability): PlanningSignal[] {
  const signals: PlanningSignal[] = []

  if (ex.momentum.mostRecentHighImpactEvent) {
    signals.push({
      label: 'Recent high-impact signal',
      detail: ex.momentum.mostRecentHighImpactEvent.title,
      observed: true,
    })
  }

  const topType = ex.momentum.topSignalTypes?.[0]?.type ?? null
  if (topType) {
    signals.push({ label: 'Top signal family', detail: formatSignalType(topType), observed: true })
  }

  if (ex.firstPartyIntent.summary.label !== 'none') {
    signals.push({
      label: 'First-party intent',
      detail: `${ex.firstPartyIntent.summary.labelText} (${ex.firstPartyIntent.visitorMatches.count} matches)`,
      observed: true,
    })
  } else {
    signals.push({
      label: 'First-party intent',
      detail: 'No match yet',
      observed: true,
    })
  }

  // Inferred examples (explicitly marked).
  if (ex.people.personas.confidence !== 'limited' && ex.people.personas.topPersonas.length > 0) {
    signals.push({
      label: 'Stakeholder path (inferred)',
      detail: `Suggested personas: ${ex.people.personas.topPersonas.slice(0, 3).join(', ')}`,
      observed: false,
    })
  }

  return signals
}

export function planningReasonSummary(ex: AccountExplainability): string {
  if (ex.firstPartyIntent.summary.label !== 'none' && ex.momentum.label === 'rising') return 'Timing and intent are both active; prioritize follow-through.'
  if (ex.firstPartyIntent.summary.label !== 'none') return 'First-party intent suggests active evaluation; prioritize a crisp next step.'
  if (ex.momentum.label === 'rising') return 'Signals are rising; act while timing is fresh.'
  if (ex.momentum.label === 'cooling') return 'Momentum is cooling; confirm context before investing deeper time.'
  return 'Signals are steady; use a lightweight plan and monitor for stronger timing.'
}

