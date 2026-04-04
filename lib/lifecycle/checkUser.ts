import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { serverEnv } from '@/lib/env'
import {
  renderAccountsNudgeEmail,
  renderPitchNudgeEmail,
  renderValueRecapEmail,
  renderWinbackEmail,
  renderWelcomeEmail,
  renderFirstOutputEmail,
  renderStarterNearLimitEmail,
  renderStarterExhaustedEmail,
  renderFeedbackRequestEmail,
  renderUpgradeConfirmationEmail,
  renderSupportHelpEmail,
  type LifecycleEmailType,
} from '@/lib/email/lifecycle'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { FREE_MAX_PREMIUM_GENERATIONS } from '@/lib/billing/premium-generations'
import { lifecycleEmailsEnabled } from '@/lib/lifecycle/config'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { getLifecycleStopReason, selectLifecycleStep, type LifecycleSendField } from '@/lib/lifecycle/policy'

type LifecycleRow = {
  user_id: string
  signup_at: string
  last_checked_at?: string | null
  welcome_sent_at?: string | null
  nudge_accounts_sent_at?: string | null
  nudge_pitch_sent_at?: string | null
  value_recap_sent_at?: string | null
  winback_sent_at?: string | null
  first_output_sent_at?: string | null
  starter_near_limit_sent_at?: string | null
  starter_exhausted_sent_at?: string | null
  feedback_request_sent_at?: string | null
  upgrade_confirm_sent_at?: string | null
}

type UserSettingsRow = {
  user_id: string
  ideal_customer?: string | null
  what_you_sell?: string | null
  product_tips_opt_in?: boolean | null
}

function hasIcp(s: UserSettingsRow | null): boolean {
  return Boolean((s?.ideal_customer ?? '').trim() || (s?.what_you_sell ?? '').trim())
}

function hoursSince(iso: string, nowMs: number): number {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return 0
  return (nowMs - ms) / (1000 * 60 * 60)
}

function daysSince(iso: string, nowMs: number): number {
  return hoursSince(iso, nowMs) / 24
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

async function canTreatAsUpgraded(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string): Promise<boolean> {
  // Match daily sweep logic: subscriptions active/trialing OR users.subscription_tier == 'pro'
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sub && ['active', 'trialing'].includes((sub as { status?: string | null }).status ?? '')) return true
  } catch {
    // ignore
  }
  try {
    const { data: userRow } = await supabase.from('users').select('subscription_tier').eq('id', userId).maybeSingle()
    return (userRow as { subscription_tier?: string | null } | null)?.subscription_tier === 'pro'
  } catch {
    return false
  }
}

async function sendLifecycleEmail(args: {
  supabase: ReturnType<typeof createSupabaseAdminClient>
  userId: string
  toEmail: string
  type: LifecycleEmailType
  appUrl: string
  meta: { accounts: number; pitches: number; starterRemaining: number }
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
              ? renderStarterNearLimitEmail({ appUrl: args.appUrl, remaining: args.meta.starterRemaining, variantSeed: args.userId })
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
                            accountsCount: args.meta.accounts,
                            pitchesCount: args.meta.pitches,
                            savedOutputsCount: args.meta.pitches,
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
      { name: 'source', value: 'lazy_cron' },
      { name: 'type', value: args.type },
    ],
  })
  if (!res.ok) return { sent: false as const, reason: 'send_failed' }
  if (res.status !== 'sent') return { sent: false as const, reason: res.reason }
  return { sent: true as const }
}

export async function checkLifecycleForUser(
  userId: string,
  _context: { triggeredBy: 'request' | 'admin' }
): Promise<{ sent: number; skipped: number; reason?: string }> {
  // If admin client can't be created (service role missing), skip safely.
  const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
  if (!hasServiceRole) return { sent: 0, skipped: 1, reason: 'supabase_admin_not_configured' }

  const supabase = createSupabaseAdminClient({ schema: 'api' })
  const now = new Date()
  const nowMs = now.getTime()
  const appUrl = getAppUrl()

  const { data: row } = await supabase
    .from('lifecycle_state')
    .select(
      'user_id, signup_at, last_checked_at, welcome_sent_at, nudge_accounts_sent_at, nudge_pitch_sent_at, first_output_sent_at, starter_near_limit_sent_at, starter_exhausted_sent_at, feedback_request_sent_at, upgrade_confirm_sent_at, value_recap_sent_at, winback_sent_at'
    )
    .eq('user_id', userId)
    .maybeSingle()

  const lifecycle = (row ?? null) as LifecycleRow | null
  if (!lifecycle) return { sent: 0, skipped: 1, reason: 'no_lifecycle_state' }

  // Cooldown: evaluate at most every 6h per user to avoid doing work on every request.
  if (lifecycle.last_checked_at && hoursSince(lifecycle.last_checked_at, nowMs) < 6) {
    return { sent: 0, skipped: 1, reason: 'cooldown' }
  }

  // Always mark last_checked_at when we evaluate (best-effort).
  await supabase.from('lifecycle_state').update({ last_checked_at: now.toISOString() }).eq('user_id', userId)

  const { data: settingsRow } = await supabase
    .from('user_settings')
    .select('user_id, ideal_customer, what_you_sell, product_tips_opt_in')
    .eq('user_id', userId)
    .maybeSingle()
  const settings = (settingsRow ?? null) as UserSettingsRow | null
  const tipsOptIn = (settings?.product_tips_opt_in ?? true) === true
  if (!tipsOptIn) return { sent: 0, skipped: 1, reason: 'opted_out' }

  const { data: userRow } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
  const toEmail = ((userRow as { email?: string | null } | null)?.email ?? '').trim()
  if (!toEmail) return { sent: 0, skipped: 1, reason: 'missing_email' }

  const accountsCountRes = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const pitchesCountRes = await supabase.from('pitches').select('id', { count: 'exact', head: true }).eq('user_id', userId)
  const usageCountRes = await supabase
    .from('usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'complete')
    .in('object_type', ['pitch', 'report'])
  const firstUsageRes = await supabase
    .from('usage_events')
    .select('created_at')
    .eq('user_id', userId)
    .eq('status', 'complete')
    .in('object_type', ['pitch', 'report'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  const accountsCount = typeof accountsCountRes.count === 'number' ? accountsCountRes.count : 0
  const pitchesCount = typeof pitchesCountRes.count === 'number' ? pitchesCountRes.count : 0
  const premiumUsed = typeof usageCountRes.count === 'number' ? usageCountRes.count : 0
  const starterLimit = FREE_MAX_PREMIUM_GENERATIONS
  const starterRemaining = Math.max(0, starterLimit - premiumUsed)
  const premiumFirstAt = ((firstUsageRes.data as { created_at?: string | null } | null)?.created_at ?? null) || null
  const premiumDays = premiumFirstAt ? daysSince(premiumFirstAt, nowMs) : null
  const activated = hasIcp(settings) && accountsCount >= 10 && pitchesCount >= 1
  const upgraded = await canTreatAsUpgraded(supabase, userId)
  const hasBouncedEmail = await hasBouncedLifecycleEmail({ supabase, userId, toEmail })
  const stopReason = getLifecycleStopReason({
    productTipsOptIn: tipsOptIn,
    hasBouncedEmail,
    upgraded,
    upgradeConfirmSentAt: lifecycle.upgrade_confirm_sent_at,
  })
  if (stopReason) return { sent: 0, skipped: 1, reason: stopReason }

  const hrs = hoursSince(lifecycle.signup_at, nowMs)
  const days = daysSince(lifecycle.signup_at, nowMs)

  const maybeSend = async (type: LifecycleEmailType, field: LifecycleSendField) => {
    if (lifecycle[field]) return { sent: 0, skipped: 1, reason: 'already_sent' }
    const res = await sendLifecycleEmail({
      supabase,
      userId,
      toEmail,
      type,
      appUrl,
      meta: { accounts: accountsCount, pitches: pitchesCount, starterRemaining },
    })
    if (!res.sent) return { sent: 0, skipped: 1, reason: res.reason }
    await supabase.from('lifecycle_state').update({ [field]: now.toISOString() }).eq('user_id', userId)
    return { sent: 1, skipped: 0 }
  }

  const next = selectLifecycleStep({
    state: {
      welcome_sent_at: lifecycle.welcome_sent_at ?? null,
      nudge_accounts_sent_at: lifecycle.nudge_accounts_sent_at ?? null,
      nudge_pitch_sent_at: lifecycle.nudge_pitch_sent_at ?? null,
      first_output_sent_at: lifecycle.first_output_sent_at ?? null,
      starter_near_limit_sent_at: lifecycle.starter_near_limit_sent_at ?? null,
      starter_exhausted_sent_at: lifecycle.starter_exhausted_sent_at ?? null,
      feedback_request_sent_at: lifecycle.feedback_request_sent_at ?? null,
      upgrade_confirm_sent_at: lifecycle.upgrade_confirm_sent_at ?? null,
      value_recap_sent_at: lifecycle.value_recap_sent_at ?? null,
      winback_sent_at: lifecycle.winback_sent_at ?? null,
    },
    hoursSinceSignup: hrs,
    daysSinceSignup: days,
    accountsCount,
    pitchesCount,
    activated,
    upgraded,
    premiumUsed,
    premiumDays,
    starterLimit,
  })
  if (next) return await maybeSend(next.type, next.field)

  return { sent: 0, skipped: 1, reason: 'not_due' }
}

