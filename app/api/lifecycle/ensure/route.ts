import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { serverEnv } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'
import { sendEmailWithResend } from '@/lib/email/resend'
import { renderWelcomeEmail } from '@/lib/email/lifecycle'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { adminNotificationsEnabled, getLifecycleAdminEmails, lifecycleEmailsEnabled } from '@/lib/lifecycle/config'
import { renderAdminNotificationEmail } from '@/lib/email/internal'
import { sendEmailDeduped } from '@/lib/email/send-deduped'

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
      .select('user_id, product_tips_opt_in')
      .maybeSingle()

    // Ensure lifecycle_state exists (do not overwrite signup_at).
    const { data: existing } = await supabase
      .from('lifecycle_state')
      .select('user_id, welcome_sent_at, first_login_at')
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
    const hasResendKey = Boolean((serverEnv.RESEND_API_KEY ?? '').trim())
    const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
    const toEmail = (user.email ?? '').trim()
    if (
      lifecycleEmailsEnabled() &&
      tipsOptIn &&
      hasResendKey &&
      from &&
      toEmail &&
      !(existing as { welcome_sent_at?: string | null } | null)?.welcome_sent_at
    ) {
      const appUrl = getAppUrl()
      const email = renderWelcomeEmail({ appUrl })
      const sendRes = await sendEmailWithResend({
        from,
        to: toEmail,
        replyTo: SUPPORT_EMAIL,
        subject: email.subject,
        html: email.html,
        text: email.text,
        tags: [{ name: 'kind', value: 'lifecycle' }, { name: 'type', value: 'welcome' }],
      })
      if (sendRes.ok) {
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
              replyTo: SUPPORT_EMAIL,
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

