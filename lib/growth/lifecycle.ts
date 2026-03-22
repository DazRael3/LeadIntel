import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getAppUrl } from '@/lib/app-url'
import { serverEnv } from '@/lib/env'
import { sendEmailWithResend } from '@/lib/email/resend'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { getResendReplyToEmail } from '@/lib/email/routing'
import {
  renderWelcomeEmail,
  renderAccountsNudgeEmail,
  renderPitchNudgeEmail,
  renderValueRecapEmail,
  renderWinbackEmail,
  type LifecycleEmailType,
} from '@/lib/email/lifecycle'
import { logInfo, logWarn, logError } from '@/lib/observability/logger'

type LifecycleRow = {
  user_id: string
  signup_at: string
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
  digest_enabled?: boolean | null
  digest_emails_opt_in?: boolean | null
  product_tips_opt_in?: boolean | null
}

type UserRow = { id: string; email?: string | null; subscription_tier?: string | null }

const ACTIVE_STATUSES = ['active', 'trialing']

function hoursSince(iso: string, nowMs: number): number {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return 0
  return (nowMs - ms) / (1000 * 60 * 60)
}

function daysSince(iso: string, nowMs: number): number {
  return hoursSince(iso, nowMs) / 24
}

function hasIcp(s: UserSettingsRow | null): boolean {
  return Boolean((s?.ideal_customer ?? '').trim() || (s?.what_you_sell ?? '').trim())
}

async function canTreatAsUpgraded(supabase: ReturnType<typeof createSupabaseAdminClient>, userId: string): Promise<boolean> {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status')
      .eq('user_id', userId)
      .in('status', ACTIVE_STATUSES)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (sub && ACTIVE_STATUSES.includes((sub as { status?: string | null }).status ?? '')) return true
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
  toEmail: string
  type: LifecycleEmailType
  payload: ReturnType<
    | typeof renderWelcomeEmail
    | typeof renderAccountsNudgeEmail
    | typeof renderPitchNudgeEmail
    | typeof renderValueRecapEmail
    | typeof renderWinbackEmail
  >
}): Promise<{ sent: boolean; reason?: string }> {
  const hasKey = Boolean((serverEnv.RESEND_API_KEY ?? '').trim())
  const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
  if (!hasKey || !from) {
    logInfo({
      scope: 'lifecycle',
      message: 'email.not_enabled',
      type: args.type,
      hasKey,
      hasFrom: Boolean(from),
    })
    return { sent: false, reason: 'not_enabled' }
  }

  const res = await sendEmailWithResend({
    from,
    to: args.toEmail,
    replyTo: getResendReplyToEmail(),
    subject: args.payload.subject,
    html: args.payload.html,
    text: args.payload.text,
    tags: [
      { name: 'kind', value: 'lifecycle' },
      { name: 'type', value: args.type },
    ],
  })

  if (!res.ok) return { sent: false, reason: 'send_failed' }
  return { sent: true }
}

export async function runLifecycleCron(args?: { now?: Date }) {
  const now = args?.now ?? new Date()
  const nowMs = now.getTime()
  const appUrl = getAppUrl()
  const supabase = createSupabaseAdminClient({ schema: 'api' })

  const summary = {
    processed: 0,
    sent: 0,
    skipped: 0,
    errors: 0,
    results: [] as Array<{ userId: string; type: LifecycleEmailType; outcome: 'sent' | 'skipped' | 'error'; reason?: string }>,
  }

  const { data: lifecycleRows, error: lifecycleError } = await supabase
    .from('lifecycle_state')
    .select('user_id, signup_at, welcome_sent_at, nudge_accounts_sent_at, nudge_pitch_sent_at, value_recap_sent_at, winback_sent_at')
    .order('signup_at', { ascending: true })

  if (lifecycleError) {
    logError({ scope: 'lifecycle', message: 'fetch_failed' })
    throw lifecycleError
  }

  const typedLifecycleRows = (lifecycleRows ?? []) as unknown as LifecycleRow[]
  const userIds = typedLifecycleRows.map((r: LifecycleRow) => r.user_id)
  if (userIds.length === 0) return summary

  const { data: settingsRows } = await supabase
    .from('user_settings')
    .select('user_id, ideal_customer, what_you_sell, digest_enabled, digest_emails_opt_in, product_tips_opt_in')
    .in('user_id', userIds)

  const settingsByUser = new Map<string, UserSettingsRow>()
  for (const r of (settingsRows ?? []) as unknown as UserSettingsRow[]) settingsByUser.set(r.user_id, r)

  for (const rowRaw of typedLifecycleRows) {
    summary.processed += 1
    const userId = rowRaw.user_id
    const settings = settingsByUser.get(userId) ?? null
    const tipsOptIn = (settings?.product_tips_opt_in ?? true) === true

    if (!tipsOptIn) {
      summary.skipped += 1
      continue
    }

    let toEmail: string | null = null
    try {
      const { data: userRow } = await supabase.from('users').select('email').eq('id', userId).maybeSingle()
      toEmail = ((userRow as UserRow | null)?.email ?? null) || null
    } catch {
      toEmail = null
    }
    if (!toEmail) {
      summary.skipped += 1
      continue
    }

    const accountsCountRes = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    const pitchesCountRes = await supabase.from('pitches').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    const accountsCount = typeof accountsCountRes.count === 'number' ? accountsCountRes.count : 0
    const pitchesCount = typeof pitchesCountRes.count === 'number' ? pitchesCountRes.count : 0
    const activated = hasIcp(settings) && accountsCount >= 10 && pitchesCount >= 1

    const upgraded = await canTreatAsUpgraded(supabase, userId)

    const hrs = hoursSince(rowRaw.signup_at, nowMs)
    const days = daysSince(rowRaw.signup_at, nowMs)

    const maybeSend = async (type: LifecycleEmailType, payload: any, field: keyof LifecycleRow) => {
      if ((rowRaw as any)[field]) return false
      const sendRes = await sendLifecycleEmail({ toEmail: toEmail!, type, payload })
      if (!sendRes.sent) {
        summary.skipped += 1
        summary.results.push({ userId, type, outcome: 'skipped', reason: sendRes.reason })
        return true
      }
      summary.sent += 1
      summary.results.push({ userId, type, outcome: 'sent' })
      await supabase.from('lifecycle_state').update({ [field]: now.toISOString() }).eq('user_id', userId)
      return true
    }

    try {
      if (!rowRaw.welcome_sent_at) {
        await maybeSend('welcome', renderWelcomeEmail({ appUrl }), 'welcome_sent_at')
        continue
      }

      if (hrs >= 6 && accountsCount < 10 && !rowRaw.nudge_accounts_sent_at) {
        await maybeSend('nudge_accounts', renderAccountsNudgeEmail({ appUrl }), 'nudge_accounts_sent_at')
        continue
      }

      if (hrs >= 24 && pitchesCount < 1 && !rowRaw.nudge_pitch_sent_at) {
        await maybeSend('nudge_pitch', renderPitchNudgeEmail({ appUrl }), 'nudge_pitch_sent_at')
        continue
      }

      if (days >= 3 && activated && !upgraded && !rowRaw.value_recap_sent_at) {
        await maybeSend(
          'value_recap',
          renderValueRecapEmail({ appUrl, accountsCount, pitchesCount, savedOutputsCount: pitchesCount }),
          'value_recap_sent_at'
        )
        continue
      }

      if (days >= 7 && !activated && !rowRaw.winback_sent_at) {
        await maybeSend('winback', renderWinbackEmail({ appUrl }), 'winback_sent_at')
        continue
      }
    } catch (e) {
      summary.errors += 1
      const msg = e instanceof Error ? e.message : 'unknown'
      logWarn({ scope: 'lifecycle', message: 'send_failed', userId, error: msg })
      summary.results.push({ userId, type: 'welcome', outcome: 'error', reason: msg })
    }
  }

  return summary
}

