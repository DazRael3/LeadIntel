import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { serverEnv } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'
import { renderWelcomeEmail } from '@/lib/email/lifecycle'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { adminNotificationsEnabled, getLifecycleAdminEmails, lifecycleEmailsEnabled } from '@/lib/lifecycle/config'
import { renderAdminNotificationEmail } from '@/lib/email/internal'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { getLifecycleStopReason } from '@/lib/lifecycle/policy'

async function hasBouncedLifecycleEmail(args: {
  supabase: ReturnType<typeof createRouteClient>
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

async function hasRepliedLifecycleEmail(args: {
  supabase: ReturnType<typeof createRouteClient>
  userId: string
}): Promise<boolean> {
  try {
    const { data, error } = await args.supabase
      .from('email_engagement')
      .select('id')
      .eq('user_id', args.userId)
      .ilike('event_type', '%repl%')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return false
    return Boolean((data as { id?: string } | null)?.id)
  } catch {
    return false
  }
}

async function canTreatAsUpgraded(supabase: ReturnType<typeof createRouteClient>, userId: string): Promise<boolean> {
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

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    // Ensure user_settings exists (defaults are applied by DB).
    const { data: ensuredSettings } = await supabase
      .from('user_settings')
      .upsert({ user_id: user.id, onboarding_completed: true }, { onConflict: 'user_id' })
      .select('user_id, product_tips_opt_in, allow_product_updates')
      .maybeSingle()

    // Ensure lifecycle_state exists (do not overwrite signup_at).
    const { data: existing } = await supabase
      .from('lifecycle_state')
      .select('user_id, welcome_sent_at, first_login_at, upgrade_confirm_sent_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!existing) {
      await supabase.from('lifecycle_state').insert({ user_id: user.id }).select('user_id').maybeSingle()
    }

    // Best-effort activity markers (for inactivity/winback logic).
    // Never block the response for these writes.
    try {
      const nowIso = new Date().toISOString()
      await supabase
        .from('lifecycle_state')
        .update({
          last_active_at: nowIso,
          ...(existing && (existing as { first_login_at?: string | null }).first_login_at ? {} : { first_login_at: nowIso }),
        })
        .eq('user_id', user.id)
    } catch {
      // ignore
    }

    // Best-effort: send welcome immediately after signup/signin when eligible.
    const tipsOptIn = ((ensuredSettings as { product_tips_opt_in?: boolean | null } | null)?.product_tips_opt_in ?? true) === true
    const allowProductUpdates = ((ensuredSettings as { allow_product_updates?: boolean | null } | null)?.allow_product_updates ?? true) === true
    const hasResendKey = Boolean((serverEnv.RESEND_API_KEY ?? '').trim())
    const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
    const toEmail = (user.email ?? '').trim()
    const hasRepliedLifecycleSignal = await hasRepliedLifecycleEmail({ supabase, userId: user.id })
    const hasBouncedEmail = toEmail ? await hasBouncedLifecycleEmail({ supabase, userId: user.id, toEmail }) : false
    const upgraded = await canTreatAsUpgraded(supabase, user.id)
    const stopReason = getLifecycleStopReason({
      allowProductUpdates,
      productTipsOptIn: tipsOptIn,
      hasRepliedLifecycleEmail: hasRepliedLifecycleSignal,
      hasBouncedEmail,
      upgraded,
      upgradeConfirmSentAt: (existing as { upgrade_confirm_sent_at?: string | null } | null)?.upgrade_confirm_sent_at ?? null,
    })
    if (
      lifecycleEmailsEnabled() &&
      !stopReason &&
      hasResendKey &&
      from &&
      toEmail &&
      !(existing as { welcome_sent_at?: string | null } | null)?.welcome_sent_at
    ) {
      const appUrl = getAppUrl()
      const email = renderWelcomeEmail({ appUrl })
      const sendRes = await sendEmailDeduped(supabase, {
        dedupeKey: `lifecycle:welcome:${user.id}`,
        userId: user.id,
        toEmail,
        fromEmail: from,
        replyTo: getResendReplyToEmail(),
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [{ name: 'kind', value: 'lifecycle' }, { name: 'type', value: 'welcome' }],
        kind: 'lifecycle',
        template: 'welcome',
      })
      if (sendRes.ok && sendRes.status === 'sent') {
        await supabase
          .from('lifecycle_state')
          .update({ welcome_sent_at: new Date().toISOString() })
          .eq('user_id', user.id)
      }
    }

    // Optional: operator notification on first lifecycle ensure (best-effort, deduped).
    try {
      const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
      const admins = getLifecycleAdminEmails()
      const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
      const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
      if (hasServiceRole && adminNotificationsEnabled() && admins.length > 0 && hasResend) {
        const appUrl = getAppUrl()
        const email = renderAdminNotificationEmail({
          title: 'New signup / first login',
          appUrl,
          lines: [`user_id: ${user.id}`, `email: ${user.email ?? '(missing)'}`],
        })
        const adminClient = createSupabaseAdminClient({ schema: 'api' })
        await Promise.allSettled(
          admins.map((to) =>
            sendEmailDeduped(adminClient, {
              dedupeKey: `admin:signup:${user.id}:${to}`,
              userId: null,
              toEmail: to,
              fromEmail: from,
              replyTo: getResendReplyToEmail(),
              subject: email.subject,
              html: email.html,
              text: email.text,
              kind: 'internal',
              template: 'admin_signup',
              tags: [{ name: 'kind', value: 'internal' }, { name: 'type', value: 'signup' }],
              meta: { userId: user.id },
            })
          )
        )
      }
    } catch {
      // best-effort
    }

    return ok({ ensured: true }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/lifecycle/ensure', undefined, bridge, requestId)
  }
})

