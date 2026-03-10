import type { RecommendationInputs } from '@/lib/recommendations/types'
import { formatSignalType } from '@/lib/domain/explainability'

export function whyNowSummary(inputs: RecommendationInputs): string {
  const top = inputs.momentum.mostRecentHighImpactEvent?.title ?? inputs.momentum.topSignalTypes?.[0]?.type ?? null
  const topLabel = top ? (top.includes(' ') ? top : formatSignalType(top)) : null

  if (inputs.firstPartyIntent.summary.label !== 'none' && inputs.firstPartyIntent.visitorMatches.count > 0) {
    return topLabel
      ? `First-party activity + ${topLabel.toLowerCase()} signals suggest active evaluation.`
      : 'First-party activity suggests active evaluation.'
  }

  if (inputs.momentum.label === 'rising') return topLabel ? `${topLabel} momentum is rising.` : 'Momentum is rising.'
  if (inputs.momentum.label === 'cooling') return 'Momentum is cooling; consider waiting for a fresher signal.'
  return topLabel ? `Recent ${topLabel.toLowerCase()} signal detected.` : 'Recent signals detected.'
}

export function supportingFactors(inputs: RecommendationInputs): Array<{ label: string; value: string; tone: 'positive' | 'caution' | 'neutral' }> {
  const factors: Array<{ label: string; value: string; tone: 'positive' | 'caution' | 'neutral' }> = []

  factors.push({ label: 'Score', value: String(Math.round(inputs.scoreExplainability.score)), tone: 'neutral' })
  factors.push({ label: 'Momentum', value: `${inputs.momentum.label} (${Math.round(inputs.momentum.delta)})`, tone: inputs.momentum.label === 'rising' ? 'positive' : inputs.momentum.label === 'cooling' ? 'caution' : 'neutral' })

  if (inputs.firstPartyIntent.summary.label !== 'none') {
    factors.push({ label: 'First-party intent', value: inputs.firstPartyIntent.summary.labelText, tone: 'positive' })
  } else {
    factors.push({ label: 'First-party intent', value: 'None yet', tone: 'caution' })
  }

  factors.push({
    label: 'Data quality',
    value: `${inputs.dataQuality.quality} / ${inputs.dataQuality.freshness}`,
    tone: inputs.dataQuality.quality === 'strong' ? 'positive' : inputs.dataQuality.quality === 'limited' ? 'caution' : 'neutral',
  })

  const topType = inputs.momentum.topSignalTypes?.[0]?.type ?? null
  if (topType) factors.push({ label: 'Top signal family', value: formatSignalType(topType), tone: 'neutral' })

  return factors
}

