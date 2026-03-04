import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { serverEnv } from '@/lib/env'
import { sendEmailWithResend } from '@/lib/email/resend'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import {
  renderAccountsNudgeEmail,
  renderPitchNudgeEmail,
  renderValueRecapEmail,
  renderWinbackEmail,
  renderWelcomeEmail,
  type LifecycleEmailType,
} from '@/lib/email/lifecycle'

type LifecycleRow = {
  user_id: string
  signup_at: string
  last_checked_at?: string | null
  welcome_sent_at?: string | null
  nudge_accounts_sent_at?: string | null
  nudge_pitch_sent_at?: string | null
  value_recap_sent_at?: string | null
  winback_sent_at?: string | null
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

async function sendLifecycleEmail(args: { toEmail: string; type: LifecycleEmailType; appUrl: string; meta: { accounts: number; pitches: number } }) {
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
                accountsCount: args.meta.accounts,
                pitchesCount: args.meta.pitches,
                savedOutputsCount: args.meta.pitches,
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
      { name: 'source', value: 'lazy_cron' },
      { name: 'type', value: args.type },
    ],
  })
  if (!res.ok) return { sent: false as const, reason: 'send_failed' }
  return { sent: true as const }
}

export async function checkLifecycleForUser(
  userId: string,
  context: { triggeredBy: 'request' | 'admin' }
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
    .select('user_id, signup_at, last_checked_at, welcome_sent_at, nudge_accounts_sent_at, nudge_pitch_sent_at, value_recap_sent_at, winback_sent_at')
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
  const accountsCount = typeof accountsCountRes.count === 'number' ? accountsCountRes.count : 0
  const pitchesCount = typeof pitchesCountRes.count === 'number' ? pitchesCountRes.count : 0
  const activated = hasIcp(settings) && accountsCount >= 10 && pitchesCount >= 1
  const upgraded = await canTreatAsUpgraded(supabase, userId)

  const hrs = hoursSince(lifecycle.signup_at, nowMs)
  const days = daysSince(lifecycle.signup_at, nowMs)

  const maybeSend = async (type: LifecycleEmailType, field: keyof LifecycleRow) => {
    if ((lifecycle as any)[field]) return { sent: 0, skipped: 1, reason: 'already_sent' }
    const res = await sendLifecycleEmail({ toEmail, type, appUrl, meta: { accounts: accountsCount, pitches: pitchesCount } })
    if (!res.sent) return { sent: 0, skipped: 1, reason: res.reason }
    await supabase.from('lifecycle_state').update({ [field]: now.toISOString() }).eq('user_id', userId)
    return { sent: 1, skipped: 0 }
  }

  // Same priority as daily sweep.
  if (!lifecycle.welcome_sent_at) return await maybeSend('welcome', 'welcome_sent_at')
  if (hrs >= 6 && accountsCount < 10 && !lifecycle.nudge_accounts_sent_at) return await maybeSend('nudge_accounts', 'nudge_accounts_sent_at')
  if (hrs >= 24 && pitchesCount < 1 && !lifecycle.nudge_pitch_sent_at) return await maybeSend('nudge_pitch', 'nudge_pitch_sent_at')
  if (days >= 3 && activated && !upgraded && !lifecycle.value_recap_sent_at) return await maybeSend('value_recap', 'value_recap_sent_at')
  if (days >= 7 && !activated && !lifecycle.winback_sent_at) return await maybeSend('winback', 'winback_sent_at')

  return { sent: 0, skipped: 1, reason: 'not_due' }
}

