import type { SupabaseClient } from '@supabase/supabase-js'
import { USE_CASE_PLAYBOOKS } from '@/lib/use-cases/playbooks'
import { fetchCrossWorkspacePlaybookNorms } from '@/lib/services/privacy-safe-aggregation'
import { crossWorkspaceBucketEligibility, workspaceOnlyEligibility, BENCHMARK_PRIVACY_VERSION } from '@/lib/benchmarking/privacy'
import { confidenceFromEvents } from '@/lib/benchmarking/aggregation'
import type { BenchmarkEligibility, BenchmarkConfidenceLabel } from '@/lib/benchmarking/types'

export const PLAYBOOK_BENCHMARKS_VERSION = `playbook_bench_v1:${BENCHMARK_PRIVACY_VERSION}`

export type PlaybookBenchmarkRow = {
  playbookSlug: string
  playbookTitle: string
  evidence: 'workspace_only' | 'cross_workspace_anonymous' | 'insufficient_evidence'
  workspaceDeliverRate: { low: number; high: number } | null
  crossWorkspaceTypicalRange: { low: number; high: number } | null
  confidence: BenchmarkConfidenceLabel
  eligibility: BenchmarkEligibility
  computedAt: string
  version: string
}

function safeMeta(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {}
}

export async function getPlaybookBenchmarks(args: {
  supabase: SupabaseClient
  workspaceId: string
  windowDays: number
  crossWorkspaceEnabled: boolean
}): Promise<{ rows: PlaybookBenchmarkRow[] }> {
  const sinceIso = new Date(Date.now() - Math.max(7, Math.min(90, args.windowDays)) * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await args.supabase
    .schema('api')
    .from('action_queue_items')
    .select('status, payload_meta, created_at')
    .eq('workspace_id', args.workspaceId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(2000)

  const items = (data ?? []) as unknown as Array<{ status?: unknown; payload_meta?: unknown }>
  const counts: Record<string, { total: number; delivered: number }> = {}
  for (const it of items) {
    const meta = safeMeta(it.payload_meta)
    const slug = typeof meta.playbookSlug === 'string' ? meta.playbookSlug : null
    if (!slug) continue
    if (!counts[slug]) counts[slug] = { total: 0, delivered: 0 }
    counts[slug]!.total += 1
    if (it.status === 'delivered') counts[slug]!.delivered += 1
  }

  const nowIso = new Date().toISOString()

  const rows: PlaybookBenchmarkRow[] = []
  for (const pb of USE_CASE_PLAYBOOKS) {
    const c = counts[pb.slug] ?? { total: 0, delivered: 0 }
    const workspaceRate = c.total > 0 ? c.delivered / c.total : null

    const cross = args.crossWorkspaceEnabled ? await fetchCrossWorkspacePlaybookNorms({ playbookSlug: pb.slug, windowDays: args.windowDays }) : { ok: false as const, reason: 'insufficient_data' as const }
    const eligibility = cross.ok
      ? crossWorkspaceBucketEligibility({ enabled: true, cohortWorkspaces: cross.cohortWorkspaces, totalBucketEvents: cross.totalActions, windowDays: cross.windowDays })
      : crossWorkspaceBucketEligibility({ enabled: args.crossWorkspaceEnabled, cohortWorkspaces: 0, totalBucketEvents: 0, windowDays: args.windowDays })

    const workspaceOnly = workspaceOnlyEligibility({ windowDays: args.windowDays })
    const evidence =
      eligibility.eligible && cross.ok && cross.deliverRate ? 'cross_workspace_anonymous' : workspaceRate !== null && c.total >= 10 ? 'workspace_only' : 'insufficient_evidence'

    rows.push({
      playbookSlug: pb.slug,
      playbookTitle: pb.title,
      evidence,
      workspaceDeliverRate: workspaceRate === null ? null : { low: Math.max(0, workspaceRate - 0.05), high: Math.min(1, workspaceRate + 0.05) },
      crossWorkspaceTypicalRange: eligibility.eligible && cross.ok && cross.deliverRate ? cross.deliverRate : null,
      confidence: confidenceFromEvents(c.total),
      eligibility: evidence === 'cross_workspace_anonymous' ? eligibility : workspaceOnly,
      computedAt: nowIso,
      version: PLAYBOOK_BENCHMARKS_VERSION,
    })
  }

  return { rows }
}

