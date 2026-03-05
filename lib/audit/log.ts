import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'

function firstForwardedIp(request: NextRequest): string | null {
  const xff = request.headers.get('x-forwarded-for') ?? ''
  const ip = (xff.split(',')[0] ?? '').trim()
  if (ip) return ip
  const realIp = (request.headers.get('x-real-ip') ?? '').trim()
  return realIp || null
}

export type AuditLogTargetType =
  | 'workspace'
  | 'member'
  | 'invite'
  | 'template_set'
  | 'template'
  | 'webhook_endpoint'
  | 'webhook_delivery'
  | 'export_job'
  | 'billing'

export async function logAudit(args: {
  supabase: SupabaseClient
  workspaceId: string
  actorUserId: string
  action: string
  targetType: AuditLogTargetType | string
  targetId?: string | null
  meta?: Record<string, unknown>
  request?: NextRequest
}): Promise<void> {
  const ip = args.request ? firstForwardedIp(args.request) : null
  const userAgent = args.request ? (args.request.headers.get('user-agent') ?? null) : null

  // Best-effort: never throw, never log secrets/PII beyond what is already explicit in meta.
  try {
    await args.supabase.schema('api').from('audit_logs').insert({
      workspace_id: args.workspaceId,
      actor_user_id: args.actorUserId,
      action: args.action,
      target_type: args.targetType,
      target_id: args.targetId ?? null,
      meta: args.meta ?? {},
      ip,
      user_agent: userAgent,
    })
  } catch {
    // fail-open
  }
}

