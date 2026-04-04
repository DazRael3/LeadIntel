import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { serverEnv } from '@/lib/env'
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
import { getResendReplyToEmail } from '@/lib/email/routing'
import { getLifecycleStopReason, selectLifecycleStep, type LifecycleSendField } from '@/lib/lifecycle/policy'

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

type UserSettingsPrefsRow = {
  user_id: string
  allow_product_updates: boolean | null
}

type ReplySignalRow = {
  user_id: string
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

async function hasBouncedLifecycleEmail(args: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  userId: string
  toEmail: string
}): Promise<boolean> {
  try {
    const { data, error } = await args.supabase
      .from('email_logs')
      .select('id')
      .eq('user_id', args.userId)
      .eq('to_email', args.toEmail)
      .eq('status', 'bounced')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return false
    return Boolean((data as { id?: string } | null)?.id)
  } catch {
    return false
  }
}

async function fetchLifecycleReplySignals(args: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  userIds: string[]
}): Promise<Set<string>> {
  if (args.userIds.length === 0) return new Set()
  try {
    const { data, error } = await args.supabase
      .from('email_engagement')
      .select('user_id')
      .in('user_id', args.userIds)
      .ilike('event_type', '%repl%')
    if (error) return new Set()
    return new Set(((data ?? []) as ReplySignalRow[]).map((r) => r.user_id))
  } catch {
    return new Set()
  }
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
      ? renderWelcomeEmail({ appUrl: args.appUrl, variantSeed: args.userId })
      : args.type === 'nudge_accounts'
        ? renderAccountsNudgeEmail({ appUrl: args.appUrl, variantSeed: args.userId })
        : args.type === 'nudge_pitch'
          ? renderPitchNudgeEmail({ appUrl: args.appUrl, variantSeed: args.userId })
          : args.type === 'first_output'
            ? renderFirstOutputEmail({ appUrl: args.appUrl, variantSeed: args.userId })
            : args.type === 'starter_near_limit'
              ? renderStarterNearLimitEmail({ appUrl: args.appUrl, remaining: args.starterRemaining, variantSeed: args.userId })
              : args.type === 'starter_exhausted'
                ? renderStarterExhaustedEmail({ appUrl: args.appUrl, variantSeed: args.userId })
                : args.type === 'feedback_request'
                  ? renderFeedbackRequestEmail({ appUrl: args.appUrl, variantSeed: args.userId })
                  : args.type === 'upgrade_confirmation'
                    ? renderUpgradeConfirmationEmail({ appUrl: args.appUrl, variantSeed: args.userId })
                    : args.type === 'support_help'
                      ? renderSupportHelpEmail({ appUrl: args.appUrl, variantSeed: args.userId })
                      : args.type === 'value_recap'
                        ? renderValueRecapEmail({
                            appUrl: args.appUrl,
                            accountsCount: args.accountsCount,
                            pitchesCount: args.pitchesCount,
                            savedOutputsCount: args.pitchesCount,
                            variantSeed: args.userId,
                          })
                        : renderWinbackEmail({ appUrl: args.appUrl, variantSeed: args.userId })

  const dedupeKey = `lifecycle:${args.type}:${args.userId}`
  const res = await sendEmailDeduped(args.supabase, {
    dedupeKey,
    userId: args.userId,
    toEmail: args.toEmail,
    fromEmail: from,
    replyTo: getResendReplyToEmail(),
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
  const [prefsRes, repliedUserIds] = await Promise.all([
    supabase.from('user_settings').select('user_id, allow_product_updates').in('user_id', ids),
    fetchLifecycleReplySignals({ supabase, userIds: ids }),
  ])
  const allowProductUpdatesByUserId = new Map(
    ((prefsRes.data ?? []) as UserSettingsPrefsRow[]).map((r) => [r.user_id, r.allow_product_updates !== false])
  )

  for (const r of rows) {
    const toEmail = (r.email ?? '').trim()
    if (!toEmail) {
      summary.skipped += 1
      continue
    }

    const hrs = hoursSince(r.signup_at, nowMs)
    const days = daysSince(r.signup_at, nowMs)
    const activated = hasIcp(r) && r.leads_count >= 10 && r.pitches_count >= 1
    const premiumUsed = typeof r.premium_used === 'number' ? r.premium_used : 0
    const starterLimit = FREE_MAX_PREMIUM_GENERATIONS
    const starterRemaining = Math.max(0, starterLimit - premiumUsed)
    const premiumFirstAt = typeof r.premium_first_at === 'string' ? r.premium_first_at : null
    const premiumDays = premiumFirstAt ? daysSince(premiumFirstAt, nowMs) : null
    const hasBouncedEmail = await hasBouncedLifecycleEmail({ supabase, userId: r.user_id, toEmail })
    const allowProductUpdates = allowProductUpdatesByUserId.get(r.user_id) ?? true
    const hasRepliedLifecycleEmail = repliedUserIds.has(r.user_id)
    const stopReason = getLifecycleStopReason({
      allowProductUpdates,
      productTipsOptIn: r.product_tips_opt_in,
      hasRepliedLifecycleEmail,
      hasBouncedEmail,
      upgraded: r.upgraded,
      upgradeConfirmSentAt: r.upgrade_confirm_sent_at,
    })
    if (stopReason) {
      summary.skipped += 1
      continue
    }
    summary.eligible += 1

    const maybeSend = async (type: LifecycleEmailType, field: LifecycleSendField) => {
      if (r[field]) return false
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
                  replyTo: getResendReplyToEmail(),
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

    const next = selectLifecycleStep({
      state: {
        welcome_sent_at: r.welcome_sent_at,
        nudge_accounts_sent_at: r.nudge_accounts_sent_at,
        nudge_pitch_sent_at: r.nudge_pitch_sent_at,
        first_output_sent_at: r.first_output_sent_at,
        starter_near_limit_sent_at: r.starter_near_limit_sent_at,
        starter_exhausted_sent_at: r.starter_exhausted_sent_at,
        feedback_request_sent_at: r.feedback_request_sent_at,
        upgrade_confirm_sent_at: r.upgrade_confirm_sent_at,
        value_recap_sent_at: r.value_recap_sent_at,
        winback_sent_at: r.winback_sent_at,
      },
      hoursSinceSignup: hrs,
      daysSinceSignup: days,
      accountsCount: r.leads_count,
      pitchesCount: r.pitches_count,
      activated,
      upgraded: r.upgraded,
      premiumUsed,
      premiumDays,
      starterLimit,
    })
    if (!next) {
      summary.skipped += 1
      continue
    }
    await maybeSend(next.type, next.field)
  }

  return { status: 'ok' as const, summary }
}

