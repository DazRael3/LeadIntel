import type { BenchmarkEligibility } from '@/lib/benchmarking/types'

export function eligibilityLimitations(eligibility: BenchmarkEligibility): { privacyNote: string; limitationsNote: string | null } {
  if (!eligibility.eligible) {
    const base = eligibility.privacyNote
    if (eligibility.reasonCode === 'DISABLED') return { privacyNote: base, limitationsNote: 'Enable cross-workspace insights in Benchmark Settings to see anonymized norms (when privacy thresholds are met).' }
    if (eligibility.reasonCode === 'COHORT_TOO_SMALL') return { privacyNote: base, limitationsNote: 'We suppress cross-workspace insights until the cohort is large enough to protect anonymity.' }
    if (eligibility.reasonCode === 'EVENTS_TOO_LOW') return { privacyNote: base, limitationsNote: 'We suppress cross-workspace insights until enough activity exists to prevent reverse engineering.' }
    return { privacyNote: base, limitationsNote: 'This benchmark is suppressed due to privacy thresholds.' }
  }

  if (eligibility.source === 'workspace_only') {
    return { privacyNote: eligibility.privacyNote, limitationsNote: 'This does not include cross-workspace norms.' }
  }

  if (eligibility.source === 'prior_period') {
    return { privacyNote: eligibility.privacyNote, limitationsNote: 'This compares your workspace to its own prior period; it is not a market benchmark.' }
  }

  return { privacyNote: eligibility.privacyNote, limitationsNote: 'Cross-workspace norms are aggregated and thresholded; they indicate broad patterns, not guarantees.' }
}

