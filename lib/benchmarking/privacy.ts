import type { BenchmarkEligibility } from '@/lib/benchmarking/types'

export const BENCHMARK_PRIVACY_VERSION = 'privacy_v1'

export const PRIVACY_THRESHOLDS = {
  minCohortWorkspaces: 10,
  minTotalEvents: 200,
  minBucketEvents: 80,
} as const

export function cohortSizeBand(n: number): '10-19' | '20-49' | '50+' {
  if (n >= 50) return '50+'
  if (n >= 20) return '20-49'
  return '10-19'
}

export function crossWorkspaceEligibility(args: {
  enabled: boolean
  cohortWorkspaces: number
  totalEvents: number
  windowDays: number
}): BenchmarkEligibility {
  if (!args.enabled) {
    return { eligible: false, source: 'suppressed', privacyNote: 'Cross-workspace insights are disabled for this workspace.', reasonCode: 'DISABLED' }
  }

  if (args.cohortWorkspaces < PRIVACY_THRESHOLDS.minCohortWorkspaces) {
    return {
      eligible: false,
      source: 'suppressed',
      privacyNote: 'Cohort is too small to show cross-workspace insights safely.',
      reasonCode: 'COHORT_TOO_SMALL',
    }
  }

  if (args.totalEvents < PRIVACY_THRESHOLDS.minTotalEvents) {
    return {
      eligible: false,
      source: 'suppressed',
      privacyNote: 'Not enough aggregated events to show cross-workspace insights safely.',
      reasonCode: 'EVENTS_TOO_LOW',
    }
  }

  return {
    eligible: true,
    source: 'cross_workspace_anonymous',
    privacyNote: 'Cross-workspace insights are aggregated and thresholded; no customer data is exposed.',
    cohort: { sizeBand: cohortSizeBand(args.cohortWorkspaces), windowDays: args.windowDays },
  }
}

export function crossWorkspaceBucketEligibility(args: {
  enabled: boolean
  cohortWorkspaces: number
  totalBucketEvents: number
  windowDays: number
}): BenchmarkEligibility {
  if (!args.enabled) {
    return { eligible: false, source: 'suppressed', privacyNote: 'Cross-workspace insights are disabled for this workspace.', reasonCode: 'DISABLED' }
  }

  if (args.cohortWorkspaces < PRIVACY_THRESHOLDS.minCohortWorkspaces) {
    return {
      eligible: false,
      source: 'suppressed',
      privacyNote: 'Cohort is too small to show cross-workspace insights safely.',
      reasonCode: 'COHORT_TOO_SMALL',
    }
  }

  if (args.totalBucketEvents < PRIVACY_THRESHOLDS.minBucketEvents) {
    return {
      eligible: false,
      source: 'suppressed',
      privacyNote: 'Not enough aggregated bucket activity to show this insight safely.',
      reasonCode: 'EVENTS_TOO_LOW',
    }
  }

  return {
    eligible: true,
    source: 'cross_workspace_anonymous',
    privacyNote: 'Cross-workspace insights are aggregated and thresholded; no customer data is exposed.',
    cohort: { sizeBand: cohortSizeBand(args.cohortWorkspaces), windowDays: args.windowDays },
  }
}

export function workspaceOnlyEligibility(args: { windowDays: number }): BenchmarkEligibility {
  return {
    eligible: true,
    source: 'workspace_only',
    privacyNote: 'This benchmark is based on your workspace activity only.',
    cohort: { sizeBand: '10-19', windowDays: args.windowDays },
  }
}

export function priorPeriodEligibility(args: { windowDays: number }): BenchmarkEligibility {
  return {
    eligible: true,
    source: 'prior_period',
    privacyNote: 'This benchmark compares your current period to your prior period.',
    cohort: { sizeBand: '10-19', windowDays: args.windowDays },
  }
}

