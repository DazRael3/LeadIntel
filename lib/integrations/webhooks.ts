import { createHmac, randomBytes } from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export type WebhookEventType =
  | 'account.created'
  | 'account.updated'
  | 'account.brief.generated'
  | 'account.exported'
  | 'account.pushed'
  | 'signal.detected'
  | 'pitch.generated'
  | 'digest.sent'
  | 'template.approved'
  | 'member.invited'
  | 'member.role_changed'
  | 'billing.subscription_updated'

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
}): Promise<void> {
  const admin = createSupabaseAdminClient({ schema: 'api' })

  // Load enabled endpoints that subscribe to this event.
  const { data: endpoints } = await admin
    .from('webhook_endpoints')
    .select('id, workspace_id, url, events, is_enabled')
    .eq('workspace_id', args.workspaceId)
    .eq('is_enabled', true)

  const targets = (endpoints ?? []).filter((e: any) => {
    const ev = Array.isArray(e.events) ? (e.events as unknown[]) : []
    return ev.includes(args.eventType)
  })

  if (targets.length === 0) return

  await admin.from('webhook_deliveries').insert(
    targets.map((e: any) => ({
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

