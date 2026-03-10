import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { EmbedAccountSummary, EmbedReadiness, EmbedShortlist } from '@/lib/embed/types'

type CountRes = { count: number | null }

async function countApprovalPending(args: { workspaceId: string }): Promise<number> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const res = (await admin
    .from('approval_requests')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .eq('status', 'pending_review')) as unknown as CountRes
  return typeof res.count === 'number' ? res.count : 0
}

async function countQueue(args: { workspaceId: string; status: string; leadId?: string | null }): Promise<number> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  let q = admin
    .from('action_queue_items')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', args.workspaceId)
    .eq('status', args.status)
  if (typeof args.leadId === 'string' && args.leadId.length > 0) q = q.eq('lead_id', args.leadId)
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

  const row = data as unknown as {
    id: string
    lead_id: string | null
    account_name: string | null
    account_domain: string | null
    program_state: string | null
  }

  const approvalsPending = await countApprovalPending({ workspaceId: args.workspaceId })

  const [ready, blocked, failed] = row.lead_id
    ? await Promise.all([
        countQueue({ workspaceId: args.workspaceId, leadId: row.lead_id, status: 'ready' }),
        countQueue({ workspaceId: args.workspaceId, leadId: row.lead_id, status: 'blocked' }),
        countQueue({ workspaceId: args.workspaceId, leadId: row.lead_id, status: 'failed' }),
      ])
    : [0, 0, 0]

  return {
    workspaceId: args.workspaceId,
    account: {
      id: row.id,
      name: row.account_name ?? null,
      domain: row.account_domain ?? null,
      programState: row.program_state ?? 'standard',
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

  const rows = (data ?? []) as unknown as Array<{
    id: string
    account_domain: string | null
    account_name: string | null
    program_state: string | null
    updated_at: string | null
  }>
  return {
    workspaceId: args.workspaceId,
    accounts: rows.map((r) => ({
      id: r.id,
      name: r.account_name ?? null,
      domain: r.account_domain ?? null,
      programState: r.program_state ?? 'standard',
      updatedAt: r.updated_at ?? new Date().toISOString(),
    })),
    computedAt: new Date().toISOString(),
  }
}

export async function getEmbedReadiness(args: { workspaceId: string }): Promise<EmbedReadiness> {
  const [ready, queued, processing, delivered, failed, blocked, manualReview, approvalsPending] = await Promise.all([
    countQueue({ workspaceId: args.workspaceId, status: 'ready' }),
    countQueue({ workspaceId: args.workspaceId, status: 'queued' }),
    countQueue({ workspaceId: args.workspaceId, status: 'processing' }),
    countQueue({ workspaceId: args.workspaceId, status: 'delivered' }),
    countQueue({ workspaceId: args.workspaceId, status: 'failed' }),
    countQueue({ workspaceId: args.workspaceId, status: 'blocked' }),
    countQueue({ workspaceId: args.workspaceId, status: 'manual_review' }),
    countApprovalPending({ workspaceId: args.workspaceId }),
  ])

  return {
    workspaceId: args.workspaceId,
    queue: { ready, queued, processing, delivered, failed, blocked, manualReview },
    approvalsPending,
    computedAt: new Date().toISOString(),
  }
}

