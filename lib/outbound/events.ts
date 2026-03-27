import type { SupabaseClient } from '@supabase/supabase-js'

export type OutboundSubjectType = 'outreach_draft' | 'content_draft'

export type OutboundEventType =
  | 'approved'
  | 'approval_revoked'
  | 'recipient_reviewed'
  | 'send_ready_set'
  | 'send_ready_unset'
  | 'exported'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'replied'
  | 'posted'

export async function logOutboundEvent(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string | null
  subjectType: OutboundSubjectType
  subjectId: string
  eventType: OutboundEventType
  channel?: string | null
  provider?: string | null
  providerMessageId?: string | null
  meta?: Record<string, unknown>
  occurredAt?: string
}): Promise<void> {
  // Best-effort: this is observability/ledger, never block UX.
  try {
    await args.supabase.schema('api').from('outbound_events').insert({
      workspace_id: args.workspaceId,
      actor_user_id: args.actorUserId,
      subject_type: args.subjectType,
      subject_id: args.subjectId,
      event_type: args.eventType,
      channel: args.channel ?? null,
      provider: args.provider ?? null,
      provider_message_id: args.providerMessageId ?? null,
      meta: args.meta ?? {},
      occurred_at: args.occurredAt ?? new Date().toISOString(),
    })
  } catch {
    // fail-open
  }
}

