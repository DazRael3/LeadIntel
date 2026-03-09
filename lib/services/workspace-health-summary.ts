import type { SupabaseClient } from '@supabase/supabase-js'
import { getDeploymentReadiness } from '@/lib/services/deployment-readiness'

export type WorkspaceHealthLabel = 'healthy' | 'needs_setup' | 'blocked' | 'stalled' | 'unknown'

export type WorkspaceHealthSummary = {
  workspaceId: string
  readiness: { label: WorkspaceHealthLabel; needsAttention: number }
  approvalsPending: number
  queueReadyBacklog48h: number
  webhookFailures7d: number
  lastActivityAt: string | null
  computedAt: string
}

type CountRes = { count: number | null; error?: unknown }

async function countRows(args: {
  supabase: SupabaseClient
  table: string
  workspaceId: string
  where?: (q: any) => any
}): Promise<number> {
  let q = args.supabase.schema('api').from(args.table).select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId)
  if (args.where) q = args.where(q)
  const res = (await q) as unknown as CountRes
  return typeof res.count === 'number' ? res.count : 0
}

export async function getWorkspaceHealthSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
}): Promise<WorkspaceHealthSummary> {
  const nowIso = new Date().toISOString()
  const staleBefore = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [readiness, approvalsPending, backlog, endpoints] = await Promise.all([
    getDeploymentReadiness({ supabase: args.supabase, workspaceId: args.workspaceId }),
    countRows({ supabase: args.supabase, table: 'approval_requests', workspaceId: args.workspaceId, where: (q) => q.eq('status', 'pending_review') }),
    countRows({
      supabase: args.supabase,
      table: 'action_queue_items',
      workspaceId: args.workspaceId,
      where: (q) => q.eq('status', 'ready').lt('created_at', staleBefore),
    }),
    args.supabase.schema('api').from('webhook_endpoints').select('id').eq('workspace_id', args.workspaceId),
  ])

  const needsAttention = (readiness.items ?? []).filter((i) => i.status === 'needs_attention').length
  const readinessLabel: WorkspaceHealthLabel = needsAttention === 0 ? 'healthy' : needsAttention >= 5 ? 'needs_setup' : 'unknown'

  const endpointIds = ((endpoints.data ?? []) as unknown as Array<{ id?: unknown }>).map((e) => e.id).filter((x): x is string => typeof x === 'string')
  let webhookFailures7d = 0
  if (endpointIds.length > 0) {
    const res = (await args.supabase
      .schema('api')
      .from('webhook_deliveries')
      .select('id', { count: 'exact', head: true })
      .in('endpoint_id', endpointIds)
      .eq('status', 'failed')
      .gte('created_at', since7d)) as unknown as CountRes
    webhookFailures7d = typeof res.count === 'number' ? res.count : 0
  }

  const { data: lastQ } = await args.supabase
    .schema('api')
    .from('action_queue_items')
    .select('created_at')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const lastActivityAt = (lastQ as { created_at?: unknown } | null)?.created_at
  const lastActivity = typeof lastActivityAt === 'string' ? lastActivityAt : null

  return {
    workspaceId: args.workspaceId,
    readiness: { label: readinessLabel, needsAttention },
    approvalsPending,
    queueReadyBacklog48h: backlog,
    webhookFailures7d,
    lastActivityAt: lastActivity,
    computedAt: nowIso,
  }
}

