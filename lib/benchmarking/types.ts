export type BenchmarkConfidenceLabel = 'limited' | 'usable' | 'strong'

export type BenchmarkSource = 'workspace_only' | 'prior_period' | 'cross_workspace_anonymous' | 'suppressed'

export type BenchmarkRange = { low: number; high: number; unit: 'ratio' | 'count' | 'hours' }

export type BenchmarkBand = 'below_norm' | 'within_norm' | 'above_norm' | 'promising_pattern' | 'mixed_pattern' | 'insufficient_evidence'

export type BenchmarkEligibility =
  | { eligible: true; source: Exclude<BenchmarkSource, 'suppressed'>; privacyNote: string; cohort: { sizeBand: '10-19' | '20-49' | '50+'; windowDays: number } }
  | { eligible: false; source: 'suppressed'; privacyNote: string; reasonCode: 'COHORT_TOO_SMALL' | 'EVENTS_TOO_LOW' | 'DISABLED' }

export type WorkflowBenchmarkArea =
  | 'follow_through_speed'
  | 'action_queue_completion'
  | 'stalled_high_priority'
  | 'blocked_items'
  | 'coverage_health'

export type WorkflowBenchmarkMetric = {
  area: WorkflowBenchmarkArea
  band: BenchmarkBand
  summary: string
  current: BenchmarkRange
  comparison: { source: BenchmarkSource; range: BenchmarkRange | null; note: string }
  confidence: BenchmarkConfidenceLabel
  limitationsNote: string | null
  eligibility: BenchmarkEligibility
  computedAt: string
  version: string
}

export type PeerPatternInsight = {
  type: 'peer_pattern'
  bucketKey: string
  band: BenchmarkBand
  summary: string
  whyThisBucket: string
  confidence: BenchmarkConfidenceLabel
  eligibility: BenchmarkEligibility
  limitationsNote: string | null
  computedAt: string
  version: string
}

