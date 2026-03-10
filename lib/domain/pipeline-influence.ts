import type { PipelineInfluenceLabel } from '@/lib/revenue/types'

export type PipelineInfluenceState = {
  label: PipelineInfluenceLabel
  labelText: string
}

export function pipelineInfluenceLabelText(label: PipelineInfluenceLabel): string {
  if (label === 'early_influence') return 'Early influence'
  if (label === 'building') return 'Building'
  if (label === 'high_attention') return 'High attention'
  if (label === 'confirmed_progression') return 'Confirmed progression'
  return 'Unknown'
}

