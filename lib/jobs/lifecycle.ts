import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { serverEnv } from '@/lib/env'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import {
  renderWelcomeEmail,
  renderAccountsNudgeEmail,
  renderPitchNudgeEmail,
  renderFirstOutputEmail,
  renderStarterNearLimitEmail,
  renderStarterExhaustedEmail,
  renderFeedbackRequestEmail,
  renderUpgradeConfirmationEmail,
  renderSupportHelpEmail,
  renderValueRecapEmail,
  renderWinbackEmail,
  type LifecycleEmailType,
} from '@/lib/email/lifecycle'
import { FREE_MAX_PREMIUM_GENERATIONS } from '@/lib/billing/premium-generations'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { adminNotificationsEnabled, getLifecycleAdminEmails, lifecycleEmailsEnabled } from '@/lib/lifecycle/config'
import { renderAdminNotificationEmail } from '@/lib/email/internal'

type BatchRow = {
  user_id: string
  signup_at: string
  last_checked_at: string | null
  welcome_sent_at: string | null
  nudge_accounts_sent_at: string | null
  nudge_pitch_sent_at: string | null
  first_output_sent_at: string | null
  starter_near_limit_sent_at: string | null
  starter_exhausted_sent_at: string | null
  feedback_request_sent_at: string | null
  upgrade_confirm_sent_at: string | null
  value_recap_sent_at: string | null
  winback_sent_at: string | null
  email: string | null
  subscription_tier: string | null
  product_tips_opt_in: boolean
  ideal_customer: string | null
  what_you_sell: string | null
  leads_count: number
  pitches_count: number
  premium_used: number
  premium_first_at: string | null
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

async function sendLifecycleEmail(args: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  userId: string
  toEmail: string
  type: LifecycleEmailType
  appUrl: string
  accountsCount: number
  pitchesCount: number
  starterRemaining: number
}) {
  const hasKey = Boolean((serverEnv.RESEND_API_KEY ?? '').trim())
  const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
  if (!lifecycleEmailsEnabled() || !hasKey || !from) return { sent: false as const, reason: 'not_enabled' }

  const payload =
    args.type === 'welcome'
      ? renderWelcomeEmail({ appUrl: args.appUrl })
      : args.type === 'nudge_accounts'
        ? renderAccountsNudgeEmail({ appUrl: args.appUrl })
        : args.type === 'nudge_pitch'
          ? renderPitchNudgeEmail({ appUrl: args.appUrl })
          : args.type === 'first_output'
            ? renderFirstOutputEmail({ appUrl: args.appUrl })
            : args.type === 'starter_near_limit'
              ? renderStarterNearLimitEmail({ appUrl: args.appUrl, remaining: args.starterRemaining })
              : args.type === 'starter_exhausted'
                ? renderStarterExhaustedEmail({ appUrl: args.appUrl })
                : args.type === 'feedback_request'
                  ? renderFeedbackRequestEmail({ appUrl: args.appUrl })
                  : args.type === 'upgrade_confirmation'
                    ? renderUpgradeConfirmationEmail({ appUrl: args.appUrl })
                    : args.type === 'support_help'
                      ? renderSupportHelpEmail({ appUrl: args.appUrl })
                      : args.type === 'value_recap'
                        ? renderValueRecapEmail({
                            appUrl: args.appUrl,
                            accountsCount: args.accountsCount,
                            pitchesCount: args.pitchesCount,
                            savedOutputsCount: args.pitchesCount,
                          })
                        : renderWinbackEmail({ appUrl: args.appUrl })

  const dedupeKey = `lifecycle:${args.type}:${args.userId}`
  const res = await sendEmailDeduped(args.supabase, {
    dedupeKey,
    userId: args.userId,
    toEmail: args.toEmail,
    fromEmail: from,
    replyTo: SUPPORT_EMAIL,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
    kind: 'lifecycle',
    template: args.type,
    tags: [
      { name: 'kind', value: 'lifecycle' },
      { name: 'source', value: 'job' },
      { name: 'type', value: args.type },
    ],
  })
  if (!res.ok) return { sent: false as const, reason: 'send_failed' }
  if (res.status !== 'sent') return { sent: false as const, reason: res.reason }
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
    const premiumUsed = typeof r.premium_used === 'number' ? r.premium_used : 0
    const starterLimit = FREE_MAX_PREMIUM_GENERATIONS
    const starterRemaining = Math.max(0, starterLimit - premiumUsed)
    const premiumFirstAt = typeof r.premium_first_at === 'string' ? r.premium_first_at : null
    const premiumDays = premiumFirstAt ? daysSince(premiumFirstAt, nowMs) : null

    const maybeSend = async (type: LifecycleEmailType, field: keyof Pick<
      BatchRow,
      | 'welcome_sent_at'
      | 'nudge_accounts_sent_at'
      | 'nudge_pitch_sent_at'
      | 'first_output_sent_at'
      | 'starter_near_limit_sent_at'
      | 'starter_exhausted_sent_at'
      | 'feedback_request_sent_at'
      | 'upgrade_confirm_sent_at'
      | 'value_recap_sent_at'
      | 'winback_sent_at'
    >) => {
      if ((r as any)[field]) return false
      const res = await sendLifecycleEmail({
        supabase,
        userId: r.user_id,
        toEmail,
        type,
        appUrl,
        accountsCount: r.leads_count,
        pitchesCount: r.pitches_count,
        starterRemaining,
      })
      if (!res.sent) {
        summary.skipped += 1
        return true
      }
      summary.sent += 1
      await supabase.from('lifecycle_state').update({ [field]: now.toISOString() }).eq('user_id', r.user_id)

      // Optional: operator visibility on first output (deduped, best-effort).
      if (type === 'first_output') {
        try {
          const admins = getLifecycleAdminEmails()
          const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
          const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
          if (adminNotificationsEnabled() && admins.length > 0 && hasResend) {
            const email = renderAdminNotificationEmail({
              title: 'First output generated',
              appUrl,
              lines: [
                `user_id: ${r.user_id}`,
                `email: ${toEmail}`,
                `premium_used: ${premiumUsed}`,
                `leads_count: ${r.leads_count}`,
                `pitches_count: ${r.pitches_count}`,
              ],
              ctaHref: `${appUrl}/admin/generations`,
              ctaLabel: 'Open generations',
            })
            await Promise.allSettled(
              admins.map((to) =>
                sendEmailDeduped(supabase, {
                  dedupeKey: `admin:first_output:${r.user_id}:${to}`,
                  userId: null,
                  toEmail: to,
                  fromEmail: from,
                  replyTo: SUPPORT_EMAIL,
                  subject: email.subject,
                  html: email.html,
                  text: email.text,
                  kind: 'internal',
                  template: 'admin_first_output',
                  tags: [{ name: 'kind', value: 'internal' }, { name: 'type', value: 'first_output' }],
                  meta: { userId: r.user_id },
                })
              )
            )
          }
        } catch {
          // best-effort
        }
      }
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
    if (hrs >= 24 && r.pitches_count < 1 && premiumUsed === 0 && !r.nudge_pitch_sent_at) {
      await maybeSend('nudge_pitch', 'nudge_pitch_sent_at')
      continue
    }

    // Starter usage reminders (only for not-upgraded users).
    if (!r.upgraded && premiumUsed >= starterLimit && !r.starter_exhausted_sent_at) {
      await maybeSend('starter_exhausted', 'starter_exhausted_sent_at')
      continue
    }
    if (!r.upgraded && premiumUsed === starterLimit - 1 && !r.starter_near_limit_sent_at) {
      await maybeSend('starter_near_limit', 'starter_near_limit_sent_at')
      continue
    }

    // Reinforce after first successful output (only if recent; avoid resurfacing months later).
    if (premiumUsed >= 1 && premiumDays !== null && premiumDays <= 7 && !r.first_output_sent_at) {
      await maybeSend('first_output', 'first_output_sent_at')
      continue
    }

    // Backstop upgrade confirmation (cron-safe) if the webhook hook missed it.
    if (r.upgraded && !r.upgrade_confirm_sent_at) {
      await maybeSend('upgrade_confirmation', 'upgrade_confirm_sent_at')
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

    // Lightweight feedback request (only once, after initial usage).
    if (!r.upgraded && premiumUsed >= 1 && premiumDays !== null && premiumDays >= 2 && !r.feedback_request_sent_at) {
      await maybeSend('feedback_request', 'feedback_request_sent_at')
      continue
    }
    summary.skipped += 1
  }

  return { status: 'ok' as const, summary }
}

