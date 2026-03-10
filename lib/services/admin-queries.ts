import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type AdminWebhookEndpointRow = {
  id: string
  workspace_id: string
  url: string
  is_enabled: boolean
  events: string[]
  created_at: string
  last_success_at: string | null
  last_error_at: string | null
  failure_count: number
  secret_last4?: string | null
  rotated_at?: string | null
}

export type AdminWebhookDeliveryRow = {
  id: string
  endpoint_id: string
  event_type: string
  event_id: string
  status: 'pending' | 'sent' | 'failed'
  attempts: number
  next_attempt_at: string
  last_status: number | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type AdminUsageEventRow = {
  id: string
  user_id: string
  status: 'reserved' | 'complete' | 'cancelled'
  object_type: 'pitch' | 'report' | null
  object_id: string | null
  created_at: string
  expires_at: string | null
  meta: unknown
}

export async function adminListWebhookEndpoints(limit = 200): Promise<AdminWebhookEndpointRow[]> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data } = await admin
    .from('webhook_endpoints')
    .select('id, workspace_id, url, is_enabled, events, created_at, last_success_at, last_error_at, failure_count, secret_last4, rotated_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(500, Math.floor(limit))))
  return (data ?? []) as AdminWebhookEndpointRow[]
}

export async function adminListRecentWebhookDeliveries(limit = 200): Promise<AdminWebhookDeliveryRow[]> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data } = await admin
    .from('webhook_deliveries')
    .select('id, endpoint_id, event_type, event_id, status, attempts, next_attempt_at, last_status, last_error, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(500, Math.floor(limit))))
  return (data ?? []) as AdminWebhookDeliveryRow[]
}

export async function adminListRecentUsageEvents(limit = 200): Promise<AdminUsageEventRow[]> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data } = await admin
    .from('usage_events')
    .select('id, user_id, status, object_type, object_id, created_at, expires_at, meta')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(500, Math.floor(limit))))
  return (data ?? []) as AdminUsageEventRow[]
}

