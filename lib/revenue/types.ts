import type { DataQualityLabel, FreshnessLabel } from '@/lib/domain/data-quality'

export type RevenueConfidenceLabel = 'limited' | 'usable' | 'strong'

export type RevenueWindow = '7d' | '30d' | '90d' | 'all'

export type RevenueOutputType =
  | 'account_plan'
  | 'pipeline_influence'
  | 'readiness_for_action'
  | 'follow_through_priority'
  | 'multi_touch_plan'
  | 'revenue_risk_caution'
  | 'manager_planning_summary'
  | 'no_action_yet'

export type ObservedSignal = {
  label: string
  detail: string
  observed: true
}

export type InferredSignal = {
  label: string
  detail: string
  observed: false
}

export type PlanningSignal = ObservedSignal | InferredSignal

export type RevenueOutput = {
  type: RevenueOutputType
  workspaceId: string
  accountId: string | null
  window: RevenueWindow
  version: string
  computedAt: string
  confidence: RevenueConfidenceLabel
  reasonSummary: string
  signals: PlanningSignal[]
  limitationsNote: string | null
}

export type PipelineInfluenceLabel = 'unknown' | 'early_influence' | 'building' | 'high_attention' | 'confirmed_progression'

export type PipelineInfluenceSummary = RevenueOutput & {
  type: 'pipeline_influence'
  influence: PipelineInfluenceLabel
  whatIsMissing: string[]
}

export type FollowThroughLabel =
  | 'ready_to_act'
  | 'needs_follow_through'
  | 'blocked'
  | 'waiting_on_review'
  | 'waiting_on_stronger_signal'
  | 'stale'

export type FollowThroughSummary = RevenueOutput & {
  type: 'readiness_for_action'
  followThrough: FollowThroughLabel
  blockers: string[]
}

export type AccountPlanTimelineStep = {
  when: 'now' | 'next' | 'later' | 'wait'
  label: string
  rationale: string
  persona: string | null
  caution: string | null
}

export type AccountPlan = RevenueOutput & {
  type: 'account_plan'
  quality: {
    dataQuality: DataQualityLabel
    freshness: FreshnessLabel
  }
  stakeholderPath: Array<{ persona: string; why: string; limitations: string[] }>
  timeline: AccountPlanTimelineStep[]
  whatWouldMakeThisStronger: string[]
}

export type TouchPlanStep = {
  step: 'touch_1' | 'touch_2' | 'fallback' | 'internal_review' | 'wait'
  label: string
  persona: string | null
  rationale: string
  caution: string | null
}

export type MultiTouchPlan = RevenueOutput & {
  type: 'multi_touch_plan'
  steps: TouchPlanStep[]
}

export type ForecastSupportBucket = {
  label:
    | 'strong_workflow_support'
    | 'may_contribute_with_follow_through'
    | 'early_thin_evidence'
    | 'fading_signal_quality'
  title: string
  description: string
  counts: { queueItems: number; delivered: number; outcomes: number }
  caution: string
}

export type ForecastSupportSummary = RevenueOutput & {
  type: 'manager_planning_summary'
  buckets: ForecastSupportBucket[]
}

