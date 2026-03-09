import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { PRIVACY_THRESHOLDS } from '@/lib/benchmarking/privacy'

type NormsRpc = {
  windowDays: number
  cohortWorkspaces: number
  totalActions: number
  totalProgressOutcomes: number
  deliverRate: { p25: number | null; p50: number | null; p75: number | null }
  staleReadyShare: { p25: number | null; p50: number | null; p75: number | null }
  blockedShare: { p25: number | null; p50: number | null; p75: number | null }
  progressOutcomeRate: { p25: number | null; p50: number | null; p75: number | null }
}

type BucketRpc = {
  windowDays: number
  bucket?: string
  playbookSlug?: string
  cohortWorkspaces: number
  totalActions: number
  deliverRate?: { p25: number | null; p50: number | null; p75: number | null }
}

function clampRatio(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

function roundToStep(n: number, step: number, dir: 'down' | 'up'): number {
  const s = Math.max(0.01, step)
  const v = clampRatio(n)
  const scaled = v / s
  const rounded = dir === 'down' ? Math.floor(scaled) : Math.ceil(scaled)
  return clampRatio(rounded * s)
}

export type SafeNormRange = { low: number; high: number } | null

function rangeFromQuartiles(q: { p25: number | null; p75: number | null }): SafeNormRange {
  if (typeof q.p25 !== 'number' || typeof q.p75 !== 'number') return null
  // Coarsen to 5% steps to avoid false precision.
  const low = roundToStep(q.p25, 0.05, 'down')
  const high = roundToStep(q.p75, 0.05, 'up')
  return { low, high }
}

export type WorkflowNormsResult =
  | { ok: true; cohortWorkspaces: number; totalActions: number; windowDays: number; norms: Record<string, SafeNormRange> }
  | { ok: false; reason: 'insufficient_data' | 'error' }

export async function fetchCrossWorkspaceWorkflowNorms(args: { windowDays: number }): Promise<WorkflowNormsResult> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data, error } = await admin.rpc('benchmark_workflow_norms', { p_days: args.windowDays })
  if (error || !data) return { ok: false, reason: 'error' }
  const raw = data as unknown as NormsRpc
  const cohortWorkspaces = Number(raw.cohortWorkspaces ?? 0)
  const totalActions = Number(raw.totalActions ?? 0)
  if (cohortWorkspaces < PRIVACY_THRESHOLDS.minCohortWorkspaces || totalActions < PRIVACY_THRESHOLDS.minTotalEvents) {
    return { ok: false, reason: 'insufficient_data' }
  }
  return {
    ok: true,
    cohortWorkspaces,
    totalActions,
    windowDays: Number(raw.windowDays ?? args.windowDays),
    norms: {
      deliverRate: rangeFromQuartiles(raw.deliverRate),
      staleReadyShare: rangeFromQuartiles(raw.staleReadyShare),
      blockedShare: rangeFromQuartiles(raw.blockedShare),
      progressOutcomeRate: rangeFromQuartiles(raw.progressOutcomeRate),
    },
  }
}

export type BucketNormsResult =
  | { ok: true; cohortWorkspaces: number; totalActions: number; windowDays: number; deliverRate: SafeNormRange }
  | { ok: false; reason: 'insufficient_data' | 'error' }

export async function fetchCrossWorkspaceBucketNorms(args: { bucketKey: string; windowDays: number }): Promise<BucketNormsResult> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data, error } = await admin.rpc('benchmark_pattern_bucket_norms', { p_bucket: args.bucketKey, p_days: args.windowDays })
  if (error || !data) return { ok: false, reason: 'error' }
  const raw = data as unknown as BucketRpc
  const cohortWorkspaces = Number(raw.cohortWorkspaces ?? 0)
  const totalActions = Number(raw.totalActions ?? 0)
  if (cohortWorkspaces < PRIVACY_THRESHOLDS.minCohortWorkspaces || totalActions < PRIVACY_THRESHOLDS.minBucketEvents) {
    return { ok: false, reason: 'insufficient_data' }
  }
  const deliverRange = raw.deliverRate ? rangeFromQuartiles(raw.deliverRate) : null
  return { ok: true, cohortWorkspaces, totalActions, windowDays: Number(raw.windowDays ?? args.windowDays), deliverRate: deliverRange }
}

export async function fetchCrossWorkspacePlaybookNorms(args: { playbookSlug: string; windowDays: number }): Promise<BucketNormsResult> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data, error } = await admin.rpc('benchmark_playbook_norms', { p_playbook_slug: args.playbookSlug, p_days: args.windowDays })
  if (error || !data) return { ok: false, reason: 'error' }
  const raw = data as unknown as BucketRpc
  const cohortWorkspaces = Number(raw.cohortWorkspaces ?? 0)
  const totalActions = Number(raw.totalActions ?? 0)
  if (cohortWorkspaces < PRIVACY_THRESHOLDS.minCohortWorkspaces || totalActions < PRIVACY_THRESHOLDS.minBucketEvents) {
    return { ok: false, reason: 'insufficient_data' }
  }
  const deliverRange = raw.deliverRate ? rangeFromQuartiles(raw.deliverRate) : null
  return { ok: true, cohortWorkspaces, totalActions, windowDays: Number(raw.windowDays ?? args.windowDays), deliverRate: deliverRange }
}

