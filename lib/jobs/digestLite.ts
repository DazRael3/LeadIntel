import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { sendEmailWithResend } from '@/lib/email/resend'
import { buildUserDigest } from '@/lib/services/digest'
import { renderDailyDigestEmailHtml, renderDailyDigestEmailText } from '@/lib/email/templates'

export async function runDigestLiteSend(args: { dryRun?: boolean }) {
  const hasKey = Boolean((serverEnv.RESEND_API_KEY ?? '').trim())
  const fromEmail = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
  if (!hasKey || !fromEmail) {
    return { status: 'skipped' as const, summary: { reason: 'resend_not_configured', hasKey, hasFromEmail: Boolean(fromEmail) } }
  }
  if (args.dryRun) {
    return { status: 'skipped' as const, summary: { reason: 'dry_run' } }
  }

  const supabase = createSupabaseAdminClient({ schema: 'api' })
  const { data: users } = await supabase
    .from('user_settings')
    .select('user_id, digest_enabled, digest_emails_opt_in')
    .eq('digest_enabled', true)

  type Row = { user_id: string; digest_emails_opt_in?: boolean | null }
  const eligible = ((users ?? []) as Row[]).filter((u) => (u.digest_emails_opt_in ?? true) === true)
  if (eligible.length === 0) return { status: 'ok' as const, summary: { subscribers: 0, sent: 0 } }

  let sent = 0
  let skipped = 0

  for (const u of eligible) {
    const built = await buildUserDigest({ userId: u.user_id, correlationId: `digest_lite:${u.user_id}:${Date.now()}` })
    if (!built.ok) {
      skipped += 1
      continue
    }

    const { data: userRow } = await supabase.from('users').select('email').eq('id', u.user_id).maybeSingle()
    const toEmail = ((userRow as { email?: string | null } | null)?.email ?? '').trim()
    if (!toEmail) {
      skipped += 1
      continue
    }

    const subject = `Your LeadIntel Digest — ${built.summary.dateIso}`
    const html = renderDailyDigestEmailHtml({
      brandName: 'LeadIntel',
      dateIso: built.summary.dateIso,
      summary: {
        highPriorityLeadCount: built.summary.highPriorityLeadCount,
        triggerEventCount: built.summary.triggerEventCount,
      },
      leads: built.summary.leads,
      footerText: 'Manage email preferences in your LeadIntel settings.',
    })
    const text = renderDailyDigestEmailText({
      brandName: 'LeadIntel',
      dateIso: built.summary.dateIso,
      summary: {
        highPriorityLeadCount: built.summary.highPriorityLeadCount,
        triggerEventCount: built.summary.triggerEventCount,
      },
      leads: built.summary.leads,
    })

    const res = await sendEmailWithResend({
      from: fromEmail,
      to: toEmail,
      subject,
      html,
      text,
      tags: [{ name: 'kind', value: 'digest_lite' }, { name: 'user_id', value: u.user_id }],
    })
    if (res.ok) sent += 1
    else skipped += 1
  }

  return { status: 'ok' as const, summary: { subscribers: eligible.length, sent, skipped } }
}

