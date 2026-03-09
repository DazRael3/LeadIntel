import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { EmbedAccountSummary, EmbedReadiness, EmbedShortlist } from '@/lib/embed/types'

type CountRes = { count: number | null }

async function count(args: { workspaceId: string; table: string; where: (q: any) => any }): Promise<number> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  let q = admin.schema('api').from(args.table).select('id', { count: 'exact', head: true }).eq('workspace_id', args.workspaceId)
  q = args.where(q)
  const res = (await q) as unknown as CountRes
  return typeof res.count === 'number' ? res.count : 0
}

export async function getEmbedAccountSummary(args: { workspaceId: string; accountId: string }): Promise<EmbedAccountSummary | null> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data } = await admin
    .from('account_program_accounts')
    .select('id, workspace_id, lead_id, account_domain, account_name, program_state, updated_at')
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.accountId)
    .maybeSingle()

  if (!data) return null

  const leadId = (data as { lead_id?: unknown } | null)?.lead_id
  const lead = typeof leadId === 'string' ? leadId : null

  const approvalsPending = await count({
    workspaceId: args.workspaceId,
    table: 'approval_requests',
    where: (q) => q.eq('status', 'pending_review'),
  })

  const [ready, blocked, failed] = lead
    ? await Promise.all([
        count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('lead_id', lead).eq('status', 'ready') }),
        count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('lead_id', lead).eq('status', 'blocked') }),
        count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('lead_id', lead).eq('status', 'failed') }),
      ])
    : [0, 0, 0]

  return {
    workspaceId: args.workspaceId,
    account: {
      id: data.id,
      name: (data as any).account_name ?? null,
      domain: (data as any).account_domain ?? null,
      programState: (data as any).program_state ?? 'standard',
    },
    readiness: { ready, blocked, failed, approvalsPending },
    computedAt: new Date().toISOString(),
  }
}

export async function getEmbedShortlist(args: { workspaceId: string; limit: number }): Promise<EmbedShortlist> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data } = await admin
    .from('account_program_accounts')
    .select('id, account_domain, account_name, program_state, updated_at')
    .eq('workspace_id', args.workspaceId)
    .order('updated_at', { ascending: false })
    .limit(Math.max(1, Math.min(25, args.limit)))

  const rows = (data ?? []) as any[]
  return {
    workspaceId: args.workspaceId,
    accounts: rows.map((r) => ({
      id: String(r.id),
      name: typeof r.account_name === 'string' ? r.account_name : null,
      domain: typeof r.account_domain === 'string' ? r.account_domain : null,
      programState: typeof r.program_state === 'string' ? r.program_state : 'standard',
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : new Date().toISOString(),
    })),
    computedAt: new Date().toISOString(),
  }
}

export async function getEmbedReadiness(args: { workspaceId: string }): Promise<EmbedReadiness> {
  const [ready, queued, processing, delivered, failed, blocked, manualReview, approvalsPending] = await Promise.all([
    count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('status', 'ready') }),
    count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('status', 'queued') }),
    count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('status', 'processing') }),
    count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('status', 'delivered') }),
    count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('status', 'failed') }),
    count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('status', 'blocked') }),
    count({ workspaceId: args.workspaceId, table: 'action_queue_items', where: (q) => q.eq('status', 'manual_review') }),
    count({ workspaceId: args.workspaceId, table: 'approval_requests', where: (q) => q.eq('status', 'pending_review') }),
  ])

  return {
    workspaceId: args.workspaceId,
    queue: { ready, queued, processing, delivered, failed, blocked, manualReview },
    approvalsPending,
    computedAt: new Date().toISOString(),
  }
}

