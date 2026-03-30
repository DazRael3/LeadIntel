import type { SupabaseClient } from '@supabase/supabase-js'
import { buildUserDigest } from '@/lib/services/digest'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'

type NotificationInsert = {
  workspace_id: string
  to_user_id: string
  from_user_id: string | null
  event_type: string
  target_type: string | null
  target_id: string | null
  body: string | null
  meta: Record<string, unknown>
  dedupe_key: string | null
}

function safeDedupeKey(userId: string, dateIso: string): string {
  // One in-app digest per user per day (can be overridden by forcing a refresh).
  const d = dateIso.trim().slice(0, 10)
  return `digest:why_now:${userId}:${d}`
}

export async function deliverInAppWhyNowDigest(args: {
  supabaseAdmin: SupabaseClient
  userId: string
  correlationId: string
  force?: boolean
}): Promise<{ ok: true } | { ok: false; reason: string }> {
  const built = await buildUserDigest({ userId: args.userId, correlationId: args.correlationId })
  if (!built.ok) return { ok: false, reason: built.reason }

  // Resolve workspace for notification scoping.
  // Use request-style helpers with the admin client (RLS bypass) but still validate membership where possible.
  await ensurePersonalWorkspace({ supabase: args.supabaseAdmin, userId: args.userId })
  const ws = await getCurrentWorkspace({ supabase: args.supabaseAdmin, userId: args.userId })
  if (!ws) return { ok: false, reason: 'workspace_missing' }

  const membership = await getWorkspaceMembership({ supabase: args.supabaseAdmin, workspaceId: ws.id, userId: args.userId })
  if (!membership) return { ok: false, reason: 'forbidden' }

  const top = built.summary.leads[0]
  const body = top
    ? `Why-now digest: ${built.summary.highPriorityLeadCount} high-priority account(s). Top: ${top.companyName} (score ${top.score}).`
    : `Why-now digest: ${built.summary.highPriorityLeadCount} high-priority account(s).`

  const dedupeKey = args.force ? null : safeDedupeKey(args.userId, built.summary.dateIso)

  const payload: NotificationInsert = {
    workspace_id: ws.id,
    to_user_id: args.userId,
    from_user_id: null,
    event_type: 'digest.why_now',
    target_type: top?.leadId ? 'lead' : null,
    target_id: top?.leadId ?? null,
    body,
    meta: {
      kind: 'why_now',
      dateIso: built.summary.dateIso,
      highPriorityLeadCount: built.summary.highPriorityLeadCount,
      triggerEventCount: built.summary.triggerEventCount,
      leads: built.summary.leads,
    },
    dedupe_key: dedupeKey,
  }

  const { error } = await args.supabaseAdmin.schema('api').from('notifications').insert(payload as never)
  if (error) {
    // Dedupe conflict: treat as ok.
    if ((error as { code?: string } | null)?.code === '23505') return { ok: true }
    return { ok: false, reason: 'insert_failed' }
  }

  return { ok: true }
}

