import type { RecommendationConfidenceLabel, RecommendationInputs } from '@/lib/recommendations/types'
import { deriveRecommendationConfidence } from '@/lib/recommendations/confidence'
import type { WorkspacePolicies } from '@/lib/domain/workspace-policies'

export type NextBestAction = {
  id: string
  label: string
  whyNow: string
  whyNot: string
  confidence: RecommendationConfidenceLabel
  limitationsNote: string | null
  dependsOn: Array<{ kind: 'plan' | 'setup' | 'policy'; note: string }>
}

export function deriveNextBestAction(args: {
  inputs: RecommendationInputs
  policies: WorkspacePolicies | null
  webhooksEnabled: boolean
}): NextBestAction {
  const conf = deriveRecommendationConfidence(args.inputs)
  const dependsOn: NextBestAction['dependsOn'] = []

  const exportAllowed = args.policies ? args.policies.exports.allowedRoles.length > 0 : true
  const requireApproval = args.policies ? args.policies.handoffs.requireApproval : false

  if (!args.webhooksEnabled) dependsOn.push({ kind: 'setup', note: 'No webhook destination configured.' })
  if (requireApproval) dependsOn.push({ kind: 'policy', note: 'Handoffs require approval in this workspace.' })

  const rising = args.inputs.momentum.label === 'rising'
  const hasFirstParty = args.inputs.firstPartyIntent.summary.label !== 'none'
  const strong = conf.label === 'strong' || (conf.label === 'usable' && (rising || hasFirstParty))

  if (strong && args.webhooksEnabled) {
    return {
      id: 'prepare_handoff',
      label: 'Prepare a handoff package',
      whyNow: 'Timing is strong; package context while signals are fresh.',
      whyNot: 'Export/webhook delivery is a downstream step; prepare first to keep payload consistent.',
      confidence: conf.label,
      limitationsNote: conf.limitationsNote,
      dependsOn,
    }
  }

  if (strong) {
    return {
      id: 'generate_first_touch',
      label: 'Generate a first touch opener',
      whyNow: 'Signals support outreach; start with a send-ready opener.',
      whyNot: 'Handoff delivery depends on destinations and policies; generate and review first.',
      confidence: conf.label,
      limitationsNote: conf.limitationsNote,
      dependsOn,
    }
  }

  if (conf.label === 'limited' || args.inputs.dataQuality.freshness === 'stale') {
    return {
      id: 'wait_or_refresh',
      label: 'Wait for a stronger signal',
      whyNow: 'Current evidence is thin; avoid forcing outreach.',
      whyNot: 'Generating or delivering a handoff now may produce lower-quality output.',
      confidence: conf.label,
      limitationsNote: conf.limitationsNote,
      dependsOn: exportAllowed ? dependsOn : [...dependsOn, { kind: 'policy', note: 'Exports are restricted by policy.' }],
    }
  }

  return {
    id: 'review_and_queue',
    label: 'Review signals and queue an action',
    whyNow: 'Evidence is usable but not definitive; a quick review avoids mis-timing.',
    whyNot: 'Direct delivery can be premature if context is incomplete.',
    confidence: conf.label,
    limitationsNote: conf.limitationsNote,
    dependsOn,
  }
}

