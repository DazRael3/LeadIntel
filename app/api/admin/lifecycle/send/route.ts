import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { isValidAdminToken } from '@/lib/admin/admin-token'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'
import { renderSupportHelpEmail, type LifecycleEmailType } from '@/lib/email/lifecycle'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

export const dynamic = 'force-dynamic'

const AllowedTypes = ['support_help'] as const

const BodySchema = z.object({
  toEmail: z.string().trim().email(),
  type: z.enum(AllowedTypes satisfies readonly [LifecycleEmailType, ...LifecycleEmailType[]]),
  userId: z.string().uuid().optional(),
  // Optional override to control dedupe window; keep privacy-safe (no secrets).
  dedupeKey: z.string().trim().min(8).max(256).optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const token = request.headers.get('x-admin-token')
      if (!isValidAdminToken(token)) {
        return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, { status: 401 }, bridge, requestId)
      }

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)
      }

      const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
      const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
      if (!hasResend) {
        return ok({ sent: false, reason: 'resend_not_configured' }, undefined, bridge, requestId)
      }

      const supabaseAdmin = createSupabaseAdminClient({ schema: 'api' })
      const appUrl = getAppUrl()
      const payload = renderSupportHelpEmail({ appUrl })
      const dateKey = new Date().toISOString().slice(0, 10)
      const dedupeKey = parsed.data.dedupeKey ?? `manual:${parsed.data.type}:${parsed.data.toEmail}:${dateKey}`

      const res = await sendEmailDeduped(supabaseAdmin, {
        dedupeKey,
        userId: parsed.data.userId ?? null,
        toEmail: parsed.data.toEmail,
        fromEmail: from,
        replyTo: SUPPORT_EMAIL,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        kind: 'internal',
        template: `manual_${parsed.data.type}`,
        tags: [{ name: 'kind', value: 'manual' }, { name: 'type', value: parsed.data.type }],
        meta: { tool: 'admin_lifecycle_send', type: parsed.data.type },
      })

      return ok({ sent: res.ok && res.status === 'sent', status: res.ok ? res.status : 'failed', ...(res.ok ? {} : { error: res.error }) }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/admin/lifecycle/send', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

