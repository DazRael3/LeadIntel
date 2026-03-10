export type CoverageConfidenceLabel = 'limited' | 'usable' | 'strong'

export type CoverageWindow = '7d' | '30d' | '90d' | 'all'

export type CoverageState =
  | 'owned_and_active'
  | 'owned_but_stale'
  | 'unowned'
  | 'blocked'
  | 'overlapping_ownership'
  | 'monitor_only'
  | 'expansion_watch'
  | 'strategic_focus'

export type CoverageOutputType =
  | 'account_coverage_summary'
  | 'uncovered_alert'
  | 'ownership_caution'
  | 'strategic_account_recommendation'
  | 'expansion_watch_recommendation'
  | 'territory_fit_summary'
  | 'coverage_health_summary'

export type CoverageSignal = {
  label: string
  detail: string
  observed: boolean
}

export type TerritoryMatch = {
  matched: boolean
  territoryKey: string | null
  ruleName: string | null
  matchType: 'domain_suffix' | 'domain_exact' | 'tag' | null
  matchValue: string | null
  note: string
}

export type AccountProgramState = 'strategic' | 'named' | 'expansion_watch' | 'monitor' | 'standard'

export type CoverageSummary = {
  type: 'account_coverage_summary'
  version: string
  workspaceId: string
  accountId: string
  window: CoverageWindow
  computedAt: string
  confidence: CoverageConfidenceLabel
  state: CoverageState
  ownerUserIds: string[]
  assignedUserIds: string[]
  territory: TerritoryMatch
  programState: AccountProgramState
  reasonSummary: string
  signals: CoverageSignal[]
  limitationsNote: string | null
  nextAction: string
}

