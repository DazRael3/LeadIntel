import type { SupabaseClient } from '@supabase/supabase-js'

export type EmailLogStatus = 'sent' | 'failed' | 'dry_run' | 'skipped'

export type EmailLogInsert = {
  userId: string
  leadId?: string | null
  toEmail: string
  fromEmail: string
  subject: string
  provider: 'resend'
  status: EmailLogStatus
  error?: string | null
  resendMessageId?: string | null
  sequenceStep?: number | null
  kind?: 'manual' | 'autopilot'
}

/**
 * Writes a single email log row.
 *
 * This helper intentionally avoids throwing on schema mismatches:
 * - First tries the most detailed insert shape (new columns).
 * - Then falls back to the minimal legacy shape when columns are missing.
 */
export async function insertEmailLog(
  // SupabaseClient schema generics vary (api/public) based on runtime configuration.
  supabase: SupabaseClient<any, any, any>,
  row: EmailLogInsert
): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  const primary = {
    user_id: row.userId,
    lead_id: row.leadId ?? null,
    to_email: row.toEmail,
    from_email: row.fromEmail,
    subject: row.subject,
    provider: row.provider,
    status: row.status,
    error: row.error ?? null,
    resend_message_id: row.resendMessageId ?? null,
    sequence_step: row.sequenceStep ?? null,
    kind: row.kind ?? 'manual',
  }

  const minimal = {
    user_id: row.userId,
    lead_id: row.leadId ?? null,
    to_email: row.toEmail,
    from_email: row.fromEmail,
    subject: row.subject,
    provider: row.provider,
    status: row.status,
    error: row.error ?? null,
  }

  try {
    const { error } = await supabase.from('email_logs').insert(primary)
    if (!error) return { ok: true }
    // Fall back on common migration-missing cases.
    const { error: fallbackError } = await supabase.from('email_logs').insert(minimal)
    if (!fallbackError) return { ok: true }
    return { ok: false, errorMessage: fallbackError.message || error.message || 'Failed to write email log' }
  } catch (err) {
    return { ok: false, errorMessage: err instanceof Error ? err.message : 'Failed to write email log' }
  }
}

