import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkflowBenchmarkMetric, BenchmarkEligibility } from '@/lib/benchmarking/types'
import { compareToNorm, confidenceFromEvents, ratioRangeFromCount } from '@/lib/benchmarking/aggregation'
import { crossWorkspaceEligibility, priorPeriodEligibility, workspaceOnlyEligibility, BENCHMARK_PRIVACY_VERSION } from '@/lib/benchmarking/privacy'
import { eligibilityLimitations } from '@/lib/benchmarking/explanations'
import { fetchCrossWorkspaceWorkflowNorms } from '@/lib/services/privacy-safe-aggregation'

export const WORKFLOW_BENCHMARKS_VERSION = `workflow_bench_v1:${BENCHMARK_PRIVACY_VERSION}`

type CountRes = { count: number | null; error?: unknown }

async function countQueue(args: {
  supabase: SupabaseClient
  workspaceId: string
  sinceIso: string
  untilIso?: string
  status?: string
  createdBeforeIso?: string
}): Promise<number> {
  let q = args.supabase
    .schema('api')
    .from('action_queue_items')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .gte('created_at', args.sinceIso)

  if (args.untilIso) q = q.lt('created_at', args.untilIso)
  if (args.status) q = q.eq('status', args.status)
  if (args.createdBeforeIso) q = q.lt('created_at', args.createdBeforeIso)

  const res = (await q) as unknown as CountRes
  return typeof res.count === 'number' ? res.count : 0
}

async function countApprovals(args: {
  supabase: SupabaseClient
  workspaceId: string
  sinceIso: string
  status?: string
}): Promise<number> {
  let q = args.supabase
    .schema('api')
    .from('approval_requests')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .gte('created_at', args.sinceIso)
  if (args.status) q = q.eq('status', args.status)
  const res = (await q) as unknown as CountRes
  return typeof res.count === 'number' ? res.count : 0
}

function windowBounds(windowDays: number): { sinceIso: string; priorSinceIso: string; priorUntilIso: string; staleBeforeIso: string } {
  const now = Date.now()
  const ms = Math.max(7, Math.min(90, windowDays)) * 24 * 60 * 60 * 1000
  return {
    sinceIso: new Date(now - ms).toISOString(),
    priorSinceIso: new Date(now - ms * 2).toISOString(),
    priorUntilIso: new Date(now - ms).toISOString(),
    staleBeforeIso: new Date(now - 48 * 60 * 60 * 1000).toISOString(),
  }
}

export async function getWorkflowBenchmarks(args: {
  supabase: SupabaseClient
  workspaceId: string
  windowDays: number
  enableCrossWorkspace: boolean
  enablePriorPeriod: boolean
}): Promise<{ metrics: WorkflowBenchmarkMetric[] }> {
  const w = windowBounds(args.windowDays)

  const [total, delivered, blocked, staleReady, approvalsTotal, approvalsApproved] = await Promise.all([
    countQueue({ supabase: args.supabase, workspaceId: args.workspaceId, sinceIso: w.sinceIso }),
    countQueue({ supabase: args.supabase, workspaceId: args.workspaceId, sinceIso: w.sinceIso, status: 'delivered' }),
    countQueue({ supabase: args.supabase, workspaceId: args.workspaceId, sinceIso: w.sinceIso, status: 'blocked' }),
    countQueue({ supabase: args.supabase, workspaceId: args.workspaceId, sinceIso: w.sinceIso, status: 'ready', createdBeforeIso: w.staleBeforeIso }),
    countApprovals({ supabase: args.supabase, workspaceId: args.workspaceId, sinceIso: w.sinceIso }),
    countApprovals({ supabase: args.supabase, workspaceId: args.workspaceId, sinceIso: w.sinceIso, status: 'approved' }),
  ])

  const prior = args.enablePriorPeriod
    ? await (async () => {
        const priorTotal = await countQueue({ supabase: args.supabase, workspaceId: args.workspaceId, sinceIso: w.priorSinceIso, untilIso: w.priorUntilIso })
        const priorDelivered = await countQueue({
          supabase: args.supabase,
          workspaceId: args.workspaceId,
          sinceIso: w.priorSinceIso,
          untilIso: w.priorUntilIso,
          status: 'delivered',
        })
        const priorStale = await countQueue({
          supabase: args.supabase,
          workspaceId: args.workspaceId,
          sinceIso: w.priorSinceIso,
          untilIso: w.priorUntilIso,
          status: 'ready',
          createdBeforeIso: w.staleBeforeIso,
        })
        return { priorTotal, priorDelivered, priorStale }
      })()
    : null

  const norms = args.enableCrossWorkspace ? await fetchCrossWorkspaceWorkflowNorms({ windowDays: args.windowDays }) : { ok: false as const, reason: 'insufficient_data' as const }

  const crossEligibility: BenchmarkEligibility = norms.ok
    ? crossWorkspaceEligibility({ enabled: true, cohortWorkspaces: norms.cohortWorkspaces, totalEvents: norms.totalActions, windowDays: args.windowDays })
    : crossWorkspaceEligibility({ enabled: args.enableCrossWorkspace, cohortWorkspaces: 0, totalEvents: 0, windowDays: args.windowDays })

  const nowIso = new Date().toISOString()

  const deliverRate = total > 0 ? delivered / total : 0
  const staleShare = total > 0 ? staleReady / total : 0
  const blockedShare = total > 0 ? blocked / total : 0
  const approvalRate = approvalsTotal > 0 ? approvalsApproved / approvalsTotal : 0

  const baseEligibility = workspaceOnlyEligibility({ windowDays: args.windowDays })

    const mk = (args2: {
    area: WorkflowBenchmarkMetric['area']
    currentRatio: number
    higherIsBetter: boolean
    title: string
      crossKey: 'deliverRate' | 'staleReadyShare' | 'blockedShare' | 'progressOutcomeRate' | null
    priorRatio: number | null
    priorNote: string
  }): WorkflowBenchmarkMetric => {
    const cross = norms.ok && args2.crossKey ? norms.norms[args2.crossKey] : null
    const comparisonSource = norms.ok && crossEligibility.eligible ? 'cross_workspace_anonymous' : args.enablePriorPeriod ? 'prior_period' : 'workspace_only'

    const comparisonRange =
      comparisonSource === 'cross_workspace_anonymous' && cross ? { low: cross.low, high: cross.high, unit: 'ratio' as const } : comparisonSource === 'prior_period' && args2.priorRatio !== null ? { low: Math.max(0, args2.priorRatio - 0.05), high: Math.min(1, args2.priorRatio + 0.05), unit: 'ratio' } : null

    const band =
      comparisonSource === 'cross_workspace_anonymous' && cross
        ? compareToNorm({
            current: args2.currentRatio,
            normP25: cross.low,
            normP75: cross.high,
            higherIsBetter: args2.higherIsBetter,
          })
        : 'insufficient_evidence'

    const confidence = confidenceFromEvents(total)

    const eligibility = comparisonSource === 'cross_workspace_anonymous' ? crossEligibility : comparisonSource === 'prior_period' ? priorPeriodEligibility({ windowDays: args.windowDays }) : baseEligibility
    const { limitationsNote } = eligibilityLimitations(eligibility)

    return {
      area: args2.area,
      band: band === 'insufficient_evidence' && comparisonSource !== 'cross_workspace_anonymous' ? 'mixed_pattern' : band,
      summary: args2.title,
      current: { low: Math.max(0, args2.currentRatio - 0.05), high: Math.min(1, args2.currentRatio + 0.05), unit: 'ratio' },
      comparison: { source: comparisonSource, range: comparisonRange, note: comparisonSource === 'prior_period' ? args2.priorNote : comparisonSource === 'cross_workspace_anonymous' ? 'Compared to anonymized, thresholded norms.' : 'Workspace-only.' },
      confidence,
      limitationsNote,
      eligibility,
      computedAt: nowIso,
      version: WORKFLOW_BENCHMARKS_VERSION,
    }
  }

  const metrics: WorkflowBenchmarkMetric[] = [
    mk({
      area: 'action_queue_completion',
      currentRatio: deliverRate,
      higherIsBetter: true,
      title: 'Action delivery completion (ready → delivered)',
      crossKey: 'deliverRate',
      priorRatio: prior && prior.priorTotal > 0 ? prior.priorDelivered / prior.priorTotal : null,
      priorNote: 'Compared to your prior period delivery rate.',
    }),
    mk({
      area: 'follow_through_speed',
      currentRatio: staleShare,
      higherIsBetter: false,
      title: 'Follow-through lag (ready items older than 48h)',
      crossKey: 'staleReadyShare',
      priorRatio: prior && prior.priorTotal > 0 ? prior.priorStale / prior.priorTotal : null,
      priorNote: 'Compared to your prior period lag share.',
    }),
    mk({
      area: 'blocked_items',
      currentRatio: blockedShare,
      higherIsBetter: false,
      title: 'Blocked or failed items share',
      crossKey: 'blockedShare',
      priorRatio: null,
      priorNote: 'Prior period comparison not available.',
    }),
    {
      area: 'coverage_health',
      band: 'mixed_pattern',
      summary: 'Approval completion readiness (approved / created)',
      current: ratioRangeFromCount({ numerator: approvalsApproved, denominator: approvalsTotal, pad: 0.05 }),
      comparison: {
        source: args.enablePriorPeriod ? 'prior_period' : 'workspace_only',
        range: null,
        note: 'Approval benchmarks are workspace-only until enough aggregated evidence exists.',
      },
      confidence: confidenceFromEvents(approvalsTotal),
      limitationsNote: 'Approval workflows vary by team; interpret as an operational cue, not a performance score.',
      eligibility: args.enablePriorPeriod ? priorPeriodEligibility({ windowDays: args.windowDays }) : baseEligibility,
      computedAt: nowIso,
      version: WORKFLOW_BENCHMARKS_VERSION,
    },
  ]

  return { metrics }
}

