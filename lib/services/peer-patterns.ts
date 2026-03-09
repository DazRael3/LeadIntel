import type { SupabaseClient } from '@supabase/supabase-js'
import { getAccountExplainability, type ExplainabilityWindow } from '@/lib/data/getAccountExplainability'
import type { PeerPatternInsight } from '@/lib/benchmarking/types'
import { derivePatternBucket } from '@/lib/services/cohorting'
import { fetchCrossWorkspaceBucketNorms } from '@/lib/services/privacy-safe-aggregation'
import { crossWorkspaceBucketEligibility, workspaceOnlyEligibility, BENCHMARK_PRIVACY_VERSION } from '@/lib/benchmarking/privacy'
import { confidenceFromEvents } from '@/lib/benchmarking/aggregation'
import { eligibilityLimitations } from '@/lib/benchmarking/explanations'

export const PEER_PATTERNS_VERSION = `peer_patterns_v1:${BENCHMARK_PRIVACY_VERSION}`

function bucketWhy(bucketKey: string): string {
  const parts = bucketKey.split('_')
  const mom = parts[1] ?? 'steady'
  const intent = parts[3] ?? 'none'
  const quality = parts[5] ?? 'usable'
  const momText = mom === 'rising' ? 'momentum is rising' : mom === 'cooling' ? 'momentum is cooling' : 'momentum is steady'
  const intentText = intent === 'active' ? 'first‑party intent is present' : 'first‑party intent is not present'
  return `This account matches a broad peer bucket where ${momText}, ${intentText}, and data quality is ${quality}.`
}

export async function getAccountPeerPatternInsight(args: {
  supabase: SupabaseClient
  userId: string
  accountId: string
  window: ExplainabilityWindow
  crossWorkspaceEnabled: boolean
}): Promise<PeerPatternInsight> {
  const explainability = await getAccountExplainability({
    supabase: args.supabase,
    userId: args.userId,
    accountId: args.accountId,
    window: args.window,
    type: null,
    sort: 'recent',
    limit: 50,
  })
  if (!explainability) throw new Error('account_not_found')

  const bucketKey = derivePatternBucket(explainability)
  const nowIso = new Date().toISOString()

  const norms = args.crossWorkspaceEnabled ? await fetchCrossWorkspaceBucketNorms({ bucketKey, windowDays: args.window === '7d' ? 7 : args.window === '90d' ? 90 : 30 }) : { ok: false as const, reason: 'insufficient_data' as const }
  const eligibility = norms.ok
    ? crossWorkspaceBucketEligibility({ enabled: true, cohortWorkspaces: norms.cohortWorkspaces, totalBucketEvents: norms.totalActions, windowDays: norms.windowDays })
    : crossWorkspaceBucketEligibility({ enabled: args.crossWorkspaceEnabled, cohortWorkspaces: 0, totalBucketEvents: 0, windowDays: args.window === '7d' ? 7 : args.window === '90d' ? 90 : 30 })

  const { limitationsNote } = eligibilityLimitations(eligibility)

  if (!eligibility.eligible || !norms.ok || !norms.deliverRate) {
    return {
      type: 'peer_pattern',
      bucketKey,
      band: 'insufficient_evidence',
      summary: 'Peer-pattern benchmark is unavailable for this bucket yet.',
      whyThisBucket: bucketWhy(bucketKey),
      confidence: 'limited',
      eligibility: eligibility.eligible ? workspaceOnlyEligibility({ windowDays: eligibility.cohort.windowDays }) : eligibility,
      limitationsNote: limitationsNote ?? 'Not enough privacy-safe evidence to show cross-workspace guidance for this bucket.',
      computedAt: nowIso,
      version: PEER_PATTERNS_VERSION,
    }
  }

  const typicalLow = norms.deliverRate.low
  const typicalHigh = norms.deliverRate.high
  const confidence = confidenceFromEvents(norms.totalActions)
  const summary =
    typicalHigh < 0.25
      ? 'Similar-context actions often stall without extra follow-through.'
      : typicalLow > 0.6
        ? 'Similar-context actions tend to complete quickly when acted on.'
        : 'Similar-context actions show mixed completion; follow-through hygiene matters.'

  return {
    type: 'peer_pattern',
    bucketKey,
    band: typicalHigh < 0.25 ? 'below_norm' : typicalLow > 0.6 ? 'above_norm' : 'within_norm',
    summary,
    whyThisBucket: bucketWhy(bucketKey),
    confidence,
    eligibility,
    limitationsNote: limitationsNote,
    computedAt: nowIso,
    version: PEER_PATTERNS_VERSION,
  }
}

