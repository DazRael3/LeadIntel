import { createHmac, randomBytes } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type WebhookEventType =
  | 'account.created'
  | 'account.updated'
  | 'account.brief.generated'
  | 'account.exported'
  | 'account.pushed'
  | 'report.generated'
  | 'signal.detected'
  | 'pitch.generated'
  | 'digest.sent'
  | 'template.approved'
  | 'member.invited'
  | 'member.role_changed'
  | 'billing.subscription_updated'
  | 'handoff.crm.prepared'
  | 'handoff.crm.delivered'
  | 'handoff.sequencer.prepared'
  | 'handoff.sequencer.delivered'
  | 'custom.action.executed'

const BACKOFF_SECONDS = [60, 5 * 60, 30 * 60, 2 * 60 * 60, 12 * 60 * 60] as const
const MAX_ATTEMPTS = 6 as const

function nextAttemptAtIso(attemptsAfterThisFailure: number): string {
  const idx = Math.max(0, Math.min(BACKOFF_SECONDS.length - 1, attemptsAfterThisFailure - 1))
  const seconds = BACKOFF_SECONDS[idx] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  return msg.length > 500 ? msg.slice(0, 497) + '...' : msg
}

function hmacSha256Hex(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input).digest('hex')
}

export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex')
}

export async function enqueueWebhookEvent(args: {
  workspaceId: string
  eventType: WebhookEventType
  eventId: string
  payload: Record<string, unknown>
  onlyEndpointId?: string
}): Promise<void> {
  const admin = createSupabaseAdminClient({ schema: 'api' })

  const rows: Array<{ id: string; events: unknown[] }> = []
  if (args.onlyEndpointId) {
    const { data } = await admin
      .from('webhook_endpoints')
      .select('id, events')
      .eq('workspace_id', args.workspaceId)
      .eq('is_enabled', true)
      .eq('id', args.onlyEndpointId)
      .maybeSingle()
    const id = (data as { id?: unknown } | null)?.id
    const events = Array.isArray((data as { events?: unknown } | null)?.events) ? ((data as { events: unknown[] }).events ?? []) : []
    if (typeof id === 'string' && id.length > 0) rows.push({ id, events })
  } else {
    const { data } = await admin
      .from('webhook_endpoints')
      .select('id, events')
      .eq('workspace_id', args.workspaceId)
      .eq('is_enabled', true)
      .limit(200)
    for (const r of (data ?? []) as unknown[]) {
      const obj = r as { id?: unknown; events?: unknown }
      const id = typeof obj.id === 'string' ? obj.id : null
      const events = Array.isArray(obj.events) ? obj.events : []
      if (id) rows.push({ id, events })
    }
  }

  const targets = rows
    .filter((e) => e.events.includes(args.eventType))

  if (targets.length === 0) return

  // Idempotency (best-effort): if the same event id/type was already enqueued for an endpoint,
  // avoid creating a duplicate delivery row on retries.
  const endpointIds = targets.map((t) => t.id)
  const { data: existing } = await admin
    .from('webhook_deliveries')
    .select('id, endpoint_id')
    .eq('event_type', args.eventType)
    .eq('event_id', args.eventId)
    .in('endpoint_id', endpointIds)
    .limit(200)

  const existingRows = (existing ?? []) as Array<{ endpoint_id?: unknown }>
  const already = new Set<string>(
    existingRows.map((r: { endpoint_id?: unknown }) => r.endpoint_id).filter((x: unknown): x is string => typeof x === 'string' && x.length > 0)
  )
  const toInsert = targets.filter((t) => !already.has(t.id))

  if (toInsert.length === 0) return

  await admin.from('webhook_deliveries').insert(
    toInsert.map((e) => ({
      endpoint_id: e.id,
      event_type: args.eventType,
      event_id: args.eventId,
      payload: args.payload,
      status: 'pending',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      last_status: null,
      last_error: null,
    }))
  )
}

export async function enqueueWebhookEventToEndpoint(args: {
  workspaceId: string
  endpointId: string
  eventType: WebhookEventType
  eventId: string
  payload: Record<string, unknown>
}): Promise<{ webhookDeliveryId: string } | null> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data: endpoint } = await admin
    .from('webhook_endpoints')
    .select('id, events, is_enabled')
    .eq('workspace_id', args.workspaceId)
    .eq('id', args.endpointId)
    .eq('is_enabled', true)
    .maybeSingle()

  if (!endpoint) return null
  const ev = Array.isArray((endpoint as { events?: unknown }).events) ? ((endpoint as { events: unknown[] }).events ?? []) : []
  if (!ev.includes(args.eventType)) return null

  const { data: existing } = await admin
    .from('webhook_deliveries')
    .select('id')
    .eq('endpoint_id', args.endpointId)
    .eq('event_type', args.eventType)
    .eq('event_id', args.eventId)
    .limit(1)
    .maybeSingle()

  const existingId = (existing as { id?: unknown } | null)?.id
  if (typeof existingId === 'string' && existingId.length > 0) return { webhookDeliveryId: existingId }

  const { data: inserted } = await admin
    .from('webhook_deliveries')
    .insert({
      endpoint_id: args.endpointId,
      event_type: args.eventType,
      event_id: args.eventId,
      payload: args.payload,
      status: 'pending',
      attempts: 0,
      next_attempt_at: new Date().toISOString(),
      last_status: null,
      last_error: null,
    })
    .select('id')
    .single()

  const id = (inserted as { id?: unknown } | null)?.id
  if (typeof id === 'string' && id.length > 0) return { webhookDeliveryId: id }
  return null
}

export async function runWebhookDeliveries(args: { limit: number }): Promise<{
  processed: number
  sent: number
  failed: number
  pending: number
}> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const nowIso = new Date().toISOString()

  const { data: deliveries } = await admin
    .from('webhook_deliveries')
    .select('id, endpoint_id, event_type, event_id, payload, status, attempts, next_attempt_at')
    .eq('status', 'pending')
    .lte('next_attempt_at', nowIso)
    .order('next_attempt_at', { ascending: true })
    .limit(args.limit)

  const rows = (deliveries ?? []) as Array<{
    id: string
    endpoint_id: string
    event_type: string
    event_id: string
    payload: Record<string, unknown>
    status: 'pending' | 'sent' | 'failed'
    attempts: number
    next_attempt_at: string
  }>

  if (rows.length === 0) {
    return { processed: 0, sent: 0, failed: 0, pending: 0 }
  }

  const endpointIds = Array.from(new Set(rows.map((r) => r.endpoint_id)))
  const { data: endpoints } = await admin
    .from('webhook_endpoints')
    .select('id, url, secret_hash, is_enabled, failure_count')
    .in('id', endpointIds)

  const endpointById = new Map<string, { id: string; url: string; is_enabled: boolean }>(
    (endpoints ?? []).map((e: any) => [e.id, { id: e.id, url: e.url, is_enabled: Boolean(e.is_enabled) }])
  )

  const { data: secrets } = await admin
    .from('webhook_endpoint_secrets')
    .select('endpoint_id, secret, revoked_at, created_at')
    .in('endpoint_id', endpointIds)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })

  const secretByEndpoint = new Map<string, string>()
  for (const s of (secrets ?? []) as any[]) {
    if (!secretByEndpoint.has(String(s.endpoint_id))) {
      secretByEndpoint.set(String(s.endpoint_id), String(s.secret))
    }
  }

  let sent = 0
  let failed = 0
  let pending = 0

  for (const d of rows) {
    const endpoint = endpointById.get(d.endpoint_id) ?? null
    const secret = secretByEndpoint.get(d.endpoint_id) ?? null

    const attemptsAfter = (d.attempts ?? 0) + 1
    const ts = Math.floor(Date.now() / 1000)
    const rawBody = JSON.stringify(d.payload ?? {})

    if (!endpoint || !endpoint.is_enabled || !secret) {
      const final = attemptsAfter >= MAX_ATTEMPTS
      await admin.from('webhook_deliveries').update({
        attempts: attemptsAfter,
        status: final ? 'failed' : 'pending',
        next_attempt_at: final ? nowIso : nextAttemptAtIso(attemptsAfter),
        last_status: null,
        last_error: final ? 'Endpoint not available' : 'Endpoint not available',
      }).eq('id', d.id)
      if (final) failed++
      else pending++
      continue
    }

    const signature = hmacSha256Hex(secret, `${ts}.${rawBody}`)

    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 5000)
    try {
      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-LeadIntel-Event': d.event_type,
          'X-LeadIntel-Timestamp': String(ts),
          'X-LeadIntel-Signature': `sha256=${signature}`,
        },
        body: rawBody,
        signal: controller.signal,
      })

      const ok = res.status >= 200 && res.status < 300
      if (ok) {
        sent++
        await admin.from('webhook_deliveries').update({
          status: 'sent',
          attempts: attemptsAfter,
          last_status: res.status,
          last_error: null,
          next_attempt_at: nowIso,
        }).eq('id', d.id)
        await admin.from('webhook_endpoints').update({
          last_success_at: nowIso,
          failure_count: 0,
        }).eq('id', d.endpoint_id)
      } else {
        const final = attemptsAfter >= MAX_ATTEMPTS
        if (final) failed++
        else pending++
        await admin.from('webhook_deliveries').update({
          status: final ? 'failed' : 'pending',
          attempts: attemptsAfter,
          last_status: res.status,
          last_error: `HTTP ${res.status}`,
          next_attempt_at: final ? nowIso : nextAttemptAtIso(attemptsAfter),
        }).eq('id', d.id)
        await admin.from('webhook_endpoints').update({
          last_error_at: nowIso,
          failure_count: (endpoints?.find((e: any) => e.id === d.endpoint_id)?.failure_count ?? 0) + 1,
        }).eq('id', d.endpoint_id)
      }
    } catch (err) {
      const final = attemptsAfter >= MAX_ATTEMPTS
      if (final) failed++
      else pending++
      await admin.from('webhook_deliveries').update({
        status: final ? 'failed' : 'pending',
        attempts: attemptsAfter,
        last_status: null,
        last_error: safeErrorMessage(err),
        next_attempt_at: final ? nowIso : nextAttemptAtIso(attemptsAfter),
      }).eq('id', d.id)
      await admin.from('webhook_endpoints').update({
        last_error_at: nowIso,
        failure_count: (endpoints?.find((e: any) => e.id === d.endpoint_id)?.failure_count ?? 0) + 1,
      }).eq('id', d.endpoint_id)
    } finally {
      clearTimeout(t)
    }
  }

  return { processed: rows.length, sent, failed, pending }
}

