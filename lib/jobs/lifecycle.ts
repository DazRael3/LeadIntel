import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { serverEnv } from '@/lib/env'
import { sendEmailWithResend } from '@/lib/email/resend'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import {
  renderWelcomeEmail,
  renderAccountsNudgeEmail,
  renderPitchNudgeEmail,
  renderValueRecapEmail,
  renderWinbackEmail,
  type LifecycleEmailType,
} from '@/lib/email/lifecycle'

type BatchRow = {
  user_id: string
  signup_at: string
  last_checked_at: string | null
  welcome_sent_at: string | null
  nudge_accounts_sent_at: string | null
  nudge_pitch_sent_at: string | null
  value_recap_sent_at: string | null
  winback_sent_at: string | null
  email: string | null
  subscription_tier: string | null
  product_tips_opt_in: boolean
  ideal_customer: string | null
  what_you_sell: string | null
  leads_count: number
  pitches_count: number
  upgraded: boolean
}

function hoursSince(iso: string, nowMs: number): number {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return 0
  return (nowMs - ms) / (1000 * 60 * 60)
}

function daysSince(iso: string, nowMs: number): number {
  return hoursSince(iso, nowMs) / 24
}

function hasIcp(r: BatchRow): boolean {
  return Boolean((r.ideal_customer ?? '').trim() || (r.what_you_sell ?? '').trim())
}

async function sendLifecycleEmail(args: { toEmail: string; type: LifecycleEmailType; appUrl: string; accountsCount: number; pitchesCount: number }) {
  const hasKey = Boolean((serverEnv.RESEND_API_KEY ?? '').trim())
  const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
  if (!hasKey || !from) return { sent: false as const, reason: 'resend_not_configured' }

  const payload =
    args.type === 'welcome'
      ? renderWelcomeEmail({ appUrl: args.appUrl })
      : args.type === 'nudge_accounts'
        ? renderAccountsNudgeEmail({ appUrl: args.appUrl })
        : args.type === 'nudge_pitch'
          ? renderPitchNudgeEmail({ appUrl: args.appUrl })
          : args.type === 'value_recap'
            ? renderValueRecapEmail({
                appUrl: args.appUrl,
                accountsCount: args.accountsCount,
                pitchesCount: args.pitchesCount,
                savedOutputsCount: args.pitchesCount,
              })
            : renderWinbackEmail({ appUrl: args.appUrl })

  const res = await sendEmailWithResend({
    from,
    to: args.toEmail,
    replyTo: SUPPORT_EMAIL,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    tags: [
      { name: 'kind', value: 'lifecycle' },
      { name: 'source', value: 'job' },
      { name: 'type', value: args.type },
    ],
  })
  if (!res.ok) return { sent: false as const, reason: 'send_failed' }
  return { sent: true as const }
}

export async function runLifecycleEmails(args: { dryRun?: boolean; limit?: number }) {
  const limit = typeof args.limit === 'number' && Number.isFinite(args.limit) ? Math.floor(args.limit) : 200
  if (args.dryRun) return { status: 'skipped' as const, summary: { reason: 'dry_run', limit } }

  const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
  if (!hasServiceRole) {
    return { status: 'skipped' as const, summary: { reason: 'supabase_admin_not_configured', limit } }
  }

  const supabase = createSupabaseAdminClient({ schema: 'api' })
  const now = new Date()
  const nowMs = now.getTime()
  const appUrl = getAppUrl()

  const summary = {
    scanned: 0,
    eligible: 0,
    sent: 0,
    skipped: 0,
    limit,
  }

  const { data, error } = await supabase.rpc('lifecycle_batch_context', { p_limit: Math.max(1, limit) })
  if (error) {
    // If RPC isn't available yet (migration not applied), fall back to safe skip.
    return { status: 'skipped' as const, summary: { reason: 'lifecycle_batch_rpc_not_available', limit } }
  }

  const rows = (data ?? []) as unknown as BatchRow[]
  summary.scanned = rows.length
  if (rows.length === 0) return { status: 'ok' as const, summary }

  // Move batch forward so repeated runs don't re-scan the same first N users.
  const ids = rows.map((r) => r.user_id)
  void supabase.from('lifecycle_state').update({ last_checked_at: now.toISOString() }).in('user_id', ids)

  for (const r of rows) {
    if (!r.product_tips_opt_in) {
      summary.skipped += 1
      continue
    }
    const toEmail = (r.email ?? '').trim()
    if (!toEmail) {
      summary.skipped += 1
      continue
    }
    summary.eligible += 1

    const hrs = hoursSince(r.signup_at, nowMs)
    const days = daysSince(r.signup_at, nowMs)
    const activated = hasIcp(r) && r.leads_count >= 10 && r.pitches_count >= 1

    const maybeSend = async (type: LifecycleEmailType, field: keyof Pick<
      BatchRow,
      'welcome_sent_at' | 'nudge_accounts_sent_at' | 'nudge_pitch_sent_at' | 'value_recap_sent_at' | 'winback_sent_at'
    >) => {
      if ((r as any)[field]) return false
      const res = await sendLifecycleEmail({
        toEmail,
        type,
        appUrl,
        accountsCount: r.leads_count,
        pitchesCount: r.pitches_count,
      })
      if (!res.sent) {
        summary.skipped += 1
        return true
      }
      summary.sent += 1
      await supabase.from('lifecycle_state').update({ [field]: now.toISOString() }).eq('user_id', r.user_id)
      return true
    }

    // Same priority order as lazy cron / historical sweep.
    if (!r.welcome_sent_at) {
      await maybeSend('welcome', 'welcome_sent_at')
      continue
    }
    if (hrs >= 6 && r.leads_count < 10 && !r.nudge_accounts_sent_at) {
      await maybeSend('nudge_accounts', 'nudge_accounts_sent_at')
      continue
    }
    if (hrs >= 24 && r.pitches_count < 1 && !r.nudge_pitch_sent_at) {
      await maybeSend('nudge_pitch', 'nudge_pitch_sent_at')
      continue
    }
    if (days >= 3 && activated && !r.upgraded && !r.value_recap_sent_at) {
      await maybeSend('value_recap', 'value_recap_sent_at')
      continue
    }
    if (days >= 7 && !activated && !r.winback_sent_at) {
      await maybeSend('winback', 'winback_sent_at')
      continue
    }
    summary.skipped += 1
  }

  return { status: 'ok' as const, summary }
}

