import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostgrestError } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env'
import { sendEmailWithResend } from '@/lib/email/resend'
import { insertEmailLog, type EmailLogKind } from '@/lib/email/email-logs'
import { captureServerEvent } from '@/lib/analytics/posthog-server'

export type DedupedSendArgs = {
  dedupeKey: string
  userId: string | null
  toEmail: string
  fromEmail: string
  replyTo?: string
  subject: string
  html: string
  text?: string
  kind: EmailLogKind
  template: string
  tags?: Array<{ name: string; value: string }>
  meta?: Record<string, unknown>
}

export type DedupedSendResult =
  | { ok: true; status: 'sent'; messageId: string }
  | { ok: true; status: 'skipped'; reason: 'deduped' | 'not_enabled' | 'schema_not_ready' }
  | { ok: false; status: 'failed'; error: string }

function isUniqueViolation(err: PostgrestError | null): boolean {
  return Boolean(err && err.code === '23505')
}

function isSchemaNotReady(err: PostgrestError | null): boolean {
  // Common Postgres codes surfaced via PostgREST when a migration hasn't applied yet.
  return Boolean(err && (err.code === '42P01' /* undefined_table */ || err.code === '42703' /* undefined_column */))
}

export async function sendEmailDeduped(
  supabaseAdmin: SupabaseClient,
  args: DedupedSendArgs
): Promise<DedupedSendResult> {
  const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean((serverEnv.RESEND_FROM_EMAIL ?? '').trim())
  if (!hasResend) {
    if (args.userId) {
      void captureServerEvent({
        distinctId: args.userId,
        event: `email_sent_${args.template}`,
        properties: { status: 'skipped', reason: 'not_enabled', template: args.template, kind: args.kind },
      })
    }
    return { ok: true, status: 'skipped', reason: 'not_enabled' }
  }

  // 1) Insert idempotency row (unique on dedupe_key).
  const { error: insertErr } = await supabaseAdmin.from('email_send_log').insert({
    dedupe_key: args.dedupeKey,
    user_id: args.userId,
    to_email: args.toEmail,
    kind: args.kind,
    template: args.template,
    status: 'skipped',
    sent_at: null,
    provider: 'resend',
    provider_message_id: null,
    error: null,
    meta: args.meta ?? {},
  })
  if (isUniqueViolation(insertErr)) {
    if (args.userId) {
      void captureServerEvent({
        distinctId: args.userId,
        event: `email_sent_${args.template}`,
        properties: { status: 'skipped', reason: 'deduped', template: args.template, kind: args.kind },
      })
    }
    return { ok: true, status: 'skipped', reason: 'deduped' }
  }
  if (isSchemaNotReady(insertErr)) {
    return { ok: true, status: 'skipped', reason: 'schema_not_ready' }
  }
  if (insertErr) {
    return { ok: false, status: 'failed', error: insertErr.message || 'email_send_log_insert_failed' }
  }

  // 2) Send
  const send = await sendEmailWithResend({
    from: args.fromEmail,
    to: args.toEmail,
    replyTo: args.replyTo,
    subject: args.subject,
    html: args.html,
    text: args.text,
    tags: args.tags,
  })

  // 3) Log to email_logs (best-effort, no throw)
  if (args.userId) {
    void insertEmailLog(supabaseAdmin, {
      userId: args.userId,
      toEmail: args.toEmail,
      fromEmail: args.fromEmail,
      subject: args.subject,
      provider: 'resend',
      status: send.ok ? 'sent' : 'failed',
      error: send.ok ? null : send.errorMessage,
      resendMessageId: send.ok ? send.messageId : null,
      kind: args.kind,
    })
  }

  if (!send.ok) {
    try {
      await supabaseAdmin
        .from('email_send_log')
        .update({ status: 'failed', error: send.errorMessage ?? 'send_failed' })
        .eq('dedupe_key', args.dedupeKey)
    } catch {
      // best-effort
    }
    if (args.userId) {
      void captureServerEvent({
        distinctId: args.userId,
        event: `email_sent_${args.template}`,
        properties: { status: 'failed', template: args.template, kind: args.kind },
      })
    }
    return { ok: false, status: 'failed', error: send.errorMessage || 'send_failed' }
  }

  try {
    await supabaseAdmin
      .from('email_send_log')
      .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: send.messageId })
      .eq('dedupe_key', args.dedupeKey)
  } catch {
    // best-effort
  }

  if (args.userId) {
    void captureServerEvent({
      distinctId: args.userId,
      event: `email_sent_${args.template}`,
      properties: { status: 'sent', template: args.template, kind: args.kind },
    })
  }
  return { ok: true, status: 'sent', messageId: send.messageId }
}

