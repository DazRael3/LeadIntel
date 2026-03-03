import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { serverEnv } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'
import { sendEmailWithResend } from '@/lib/email/resend'
import { renderWelcomeEmail } from '@/lib/email/lifecycle'

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
      .select('user_id, welcome_sent_at')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!existing) {
      await supabase.from('lifecycle_state').insert({ user_id: user.id }).select('user_id').maybeSingle()
    }

    // Best-effort: send welcome immediately after signup/signin when eligible.
    const tipsOptIn = ((ensuredSettings as { product_tips_opt_in?: boolean | null } | null)?.product_tips_opt_in ?? true) === true
    const hasResendKey = Boolean((serverEnv.RESEND_API_KEY ?? '').trim())
    const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
    const toEmail = (user.email ?? '').trim()
    if (tipsOptIn && hasResendKey && from && toEmail && !(existing as { welcome_sent_at?: string | null } | null)?.welcome_sent_at) {
      const appUrl = getAppUrl()
      const email = renderWelcomeEmail({ appUrl })
      const sendRes = await sendEmailWithResend({
        from,
        to: toEmail,
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

    return ok({ ensured: true }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/lifecycle/ensure', undefined, bridge, requestId)
  }
})

