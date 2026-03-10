import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExecutiveHighlight, ExecutiveSummary } from '@/lib/executive/types'

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

export async function buildExecutiveSummary(args: { supabase: SupabaseClient; workspaceId: string }): Promise<ExecutiveSummary> {
  const computedAt = new Date().toISOString()
  const since7d = isoDaysAgo(7)

  const [readyRes, blockedRes, approvalsRes, failsRes, strategicRes] = await Promise.all([
    args.supabase.schema('api').from('action_queue_items').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('status', 'ready'),
    args.supabase.schema('api').from('action_queue_items').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).in('status', ['failed', 'blocked']),
    args.supabase.schema('api').from('approval_requests').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('status', 'pending_review'),
    args.supabase.schema('api').from('action_deliveries').select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId).eq('status', 'failed').gte('created_at', since7d),
    args.supabase
      .schema('api')
      .from('account_program_accounts')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', args.workspaceId)
      .in('program_state', ['strategic', 'named']),
  ])

  const ready = typeof readyRes.count === 'number' ? readyRes.count : 0
  const blocked = typeof blockedRes.count === 'number' ? blockedRes.count : 0
  const approvalsPending = typeof approvalsRes.count === 'number' ? approvalsRes.count : 0
  const failedDeliveries7d = typeof failsRes.count === 'number' ? failsRes.count : 0
  const strategicPrograms = typeof strategicRes.count === 'number' ? strategicRes.count : 0

  const highlights: ExecutiveHighlight[] = []
  const risks: ExecutiveHighlight[] = []

  if (ready > 0) {
    highlights.push({
      kind: 'attention',
      title: 'Ready actions',
      detail: `${ready} handoffs or deliveries are ready to complete.`,
    })
  } else {
    highlights.push({ kind: 'positive', title: 'No ready handoffs', detail: 'No immediate handoff/delivery work is waiting in the queue.' })
  }

  if (strategicPrograms > 0) {
    highlights.push({ kind: 'attention', title: 'Strategic coverage', detail: `${strategicPrograms} accounts are flagged as strategic/named in programs.` })
  }

  if (approvalsPending > 0) risks.push({ kind: 'risk', title: 'Approval backlog', detail: `${approvalsPending} items are pending review.` })
  if (blocked > 0) risks.push({ kind: 'risk', title: 'Blocked workflow', detail: `${blocked} queue items are blocked/failed and need attention.` })
  if (failedDeliveries7d > 0) risks.push({ kind: 'risk', title: 'Delivery failures (7d)', detail: `${failedDeliveries7d} deliveries failed recently. Review destinations and retry causes.` })

  const limitationsNote =
    'Executive summaries are derived from observed workspace workflow objects (queue, approvals, deliveries, programs). They are not real-time, do not include revenue forecasting, and do not expose protected message bodies.'

  return {
    workspaceId: args.workspaceId,
    computedAt,
    metrics: {
      actionQueueReady: ready,
      actionQueueBlocked: blocked,
      approvalsPending,
      deliveriesFailed7d: failedDeliveries7d,
      strategicPrograms,
    },
    highlights,
    risks,
    limitationsNote,
  }
}

