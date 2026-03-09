import type { SupabaseClient } from '@supabase/supabase-js'

export type PlanningQueueItem = {
  id: string
  leadId: string | null
  actionType: string
  status: string
  reason: string | null
  error: string | null
  createdAt: string
  companyName: string | null
  companyDomain: string | null
}

export type WeeklyPlanningSummary = {
  workspaceId: string
  computedAt: string
  buckets: {
    workNow: PlanningQueueItem[]
    blocked: PlanningQueueItem[]
    waitingOnReview: PlanningQueueItem[]
    needsFollowThrough: PlanningQueueItem[]
    deliveredRecently: PlanningQueueItem[]
  }
}

type QueueRow = {
  id: string
  lead_id: string | null
  action_type: string
  status: string
  reason: string | null
  error: string | null
  created_at: string
}

type LeadRow = { id: string; company_name: string | null; company_domain: string | null }

function normalizeCompany(row: unknown): { companyName: string | null; companyDomain: string | null } {
  const r = row as Partial<LeadRow>
  return {
    companyName: typeof r.company_name === 'string' ? r.company_name : null,
    companyDomain: typeof r.company_domain === 'string' ? r.company_domain : null,
  }
}

export async function buildWeeklyPlanningSummary(args: {
  supabase: SupabaseClient
  workspaceId: string
  viewerUserId: string
  limit: number
}): Promise<WeeklyPlanningSummary> {
  const computedAt = new Date().toISOString()

  const { data: rows } = await args.supabase
    .schema('api')
    .from('action_queue_items')
    .select('id, lead_id, action_type, status, reason, error, created_at')
    .eq('workspace_id', args.workspaceId)
    .order('created_at', { ascending: false })
    .limit(Math.max(25, Math.min(200, args.limit)))

  const items = (rows ?? []) as unknown as QueueRow[]

  const leadIds = Array.from(new Set(items.map((i) => i.lead_id).filter((x): x is string => typeof x === 'string')))
  const leadMap = new Map<string, { companyName: string | null; companyDomain: string | null }>()

  // Best-effort: viewer can only resolve their own leads due to RLS.
  if (leadIds.length > 0) {
    const { data: leads } = await args.supabase
      .schema('api')
      .from('leads')
      .select('id, company_name, company_domain')
      .eq('user_id', args.viewerUserId)
      .in('id', leadIds.slice(0, 200))

    for (const l of leads ?? []) {
      const id = (l as { id?: unknown }).id
      if (typeof id !== 'string') continue
      leadMap.set(id, normalizeCompany(l))
    }
  }

  const normalized: PlanningQueueItem[] = items.map((r) => {
    const leadId = r.lead_id
    const company = leadId ? leadMap.get(leadId) ?? { companyName: null, companyDomain: null } : { companyName: null, companyDomain: null }
    return {
      id: r.id,
      leadId,
      actionType: r.action_type,
      status: r.status,
      reason: r.reason,
      error: r.error,
      createdAt: r.created_at,
      companyName: company.companyName,
      companyDomain: company.companyDomain,
    }
  })

  const workNow = normalized.filter((i) => i.status === 'ready')
  const blocked = normalized.filter((i) => i.status === 'failed' || i.status === 'blocked')
  const waitingOnReview = normalized.filter((i) => i.status === 'manual_review' || i.actionType === 'manual_review_required')
  const needsFollowThrough = normalized.filter((i) => i.status === 'ready' && (i.actionType.includes('handoff') || i.actionType.includes('delivery')))
  const deliveredRecently = normalized.filter((i) => i.status === 'delivered').slice(0, 25)

  return {
    workspaceId: args.workspaceId,
    computedAt,
    buckets: {
      workNow: workNow.slice(0, 25),
      blocked: blocked.slice(0, 25),
      waitingOnReview: waitingOnReview.slice(0, 25),
      needsFollowThrough: needsFollowThrough.slice(0, 25),
      deliveredRecently,
    },
  }
}

