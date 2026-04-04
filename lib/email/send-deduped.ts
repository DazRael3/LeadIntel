import type { SupabaseClient } from '@supabase/supabase-js'
import type { PostgrestError } from '@supabase/supabase-js'
import { serverEnv } from '@/lib/env'
import { sendEmailWithResend } from '@/lib/email/resend'
import { insertEmailLog, type EmailLogKind } from '@/lib/email/email-logs'
import { captureServerEvent } from '@/lib/analytics/posthog-server'
import { qaEmailTemplate } from '@/lib/email/qa'
import { isEmailTemplateId } from '@/lib/email/registry'

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
  | { ok: false; status: 'failed'; error: string; retryable: boolean }

function isUniqueViolation(err: PostgrestError | null): boolean {
  return Boolean(err && err.code === '23505')
}

function isSchemaNotReady(err: PostgrestError | null): boolean {
  // Common Postgres codes surfaced via PostgREST when a migration hasn't applied yet.
  return Boolean(err && (err.code === '42P01' /* undefined_table */ || err.code === '42703' /* undefined_column */))
}

function isPermanentProviderError(message: string): boolean {
  const text = message.toLowerCase()
  return (
    text.includes('domain is not verified') ||
    text.includes('invalid to address') ||
    text.includes('invalid from address') ||
    text.includes('recipient address rejected') ||
    text.includes('suppressed') ||
    text.includes('blocked')
  )
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

  // Template quality guardrail: never hard-fail sending, but record QA issues for ops review.
  // This avoids shipping broken templates while keeping production resilient.
  try {
    const templateId = isEmailTemplateId(args.template) ? args.template : null
    if (!templateId) {
      // Unknown template name (legacy callers). Skip QA rather than misclassifying.
      // Still safe: send will proceed and meta can be added by callers if desired.
    } else {
      const qaIssues = qaEmailTemplate({
        templateId,
        rendered: {
          subject: args.subject,
          html: args.html,
          text: args.text ?? '',
          templateName: args.template,
          kind: args.kind === 'lifecycle' ? 'lifecycle' : args.kind === 'internal' ? 'internal' : 'internal',
        },
      })
      if (qaIssues.length > 0) {
        // Attach to meta so it’s queryable in email_send_log without logging content.
        args.meta = { ...(args.meta ?? {}), qa: { issues: qaIssues.map((i) => i.code) } }
      }
    }
  } catch {
    // ignore
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
    return { ok: false, status: 'failed', error: insertErr.message || 'email_send_log_insert_failed', retryable: true }
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
    const providerError = send.errorMessage || 'send_failed'
    const retryable = !isPermanentProviderError(providerError)
    try {
      await supabaseAdmin
        .from('email_send_log')
        .update({ status: 'failed', error: providerError, meta: { ...(args.meta ?? {}), retryable } })
        .eq('dedupe_key', args.dedupeKey)
    } catch {
      // best-effort
    }
    if (retryable) {
      try {
        await supabaseAdmin.from('email_send_log').delete().eq('dedupe_key', args.dedupeKey)
      } catch {
        // best-effort
      }
    }
    if (args.userId) {
      void captureServerEvent({
        distinctId: args.userId,
        event: `email_sent_${args.template}`,
        properties: { status: 'failed', template: args.template, kind: args.kind, retryable },
      })
    }
    return { ok: false, status: 'failed', error: providerError, retryable }
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

