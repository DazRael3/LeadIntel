import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { createCookieBridge, ok, fail, ErrorCode, HttpStatus } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { getAppUrl } from '@/lib/app-url'
import { adminNotificationsEnabled, getFeedbackNotificationEmails } from '@/lib/lifecycle/config'
import { renderAdminNotificationEmail } from '@/lib/email/internal'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { SUPPORT_EMAIL } from '@/lib/config/contact'

const FeedbackSchema = z.object({
  route: z.string().min(1).max(512),
  surface: z.string().min(1).max(64),
  sentiment: z.enum(['up', 'down', 'note']),
  message: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  deviceClass: z.enum(['mobile', 'desktop', 'unknown']).optional().default('unknown'),
  viewport: z
    .object({
      w: z.number().int().min(0).max(10000).optional(),
      h: z.number().int().min(0).max(10000).optional(),
    })
    .optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    const rid = requestId

    if (body === undefined) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid feedback payload', undefined, { status: 400 }, bridge, rid)
    }

    try {
      const supabase = createRouteClient(request, bridge)
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const payload = body as z.infer<typeof FeedbackSchema>
      const insert = {
        user_id: user?.id ?? null,
        route: payload.route,
        surface: payload.surface,
        sentiment: payload.sentiment,
        message: payload.message ?? null,
        device_class: payload.deviceClass,
        viewport_w: payload.viewport?.w ?? null,
        viewport_h: payload.viewport?.h ?? null,
        meta: {},
      }

      const { data: saved, error } = await supabase.from('feedback').insert(insert).select('id').maybeSingle()
      if (error || !(saved as { id?: string } | null)?.id) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to save feedback', undefined, { status: 500 }, bridge, rid)
      }

      // Optional: operator notification (best-effort, deduped). Never block user success.
      try {
        const hasServiceRole = Boolean((process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim())
        const admins = getFeedbackNotificationEmails()
        const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
        const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
        if (hasServiceRole && adminNotificationsEnabled() && admins.length > 0 && hasResend) {
          const feedbackId = (saved as { id: string }).id
          const appUrl = getAppUrl()
          const email = renderAdminNotificationEmail({
            title: 'Feedback submitted',
            appUrl,
            ctaHref: `${appUrl}${payload.route}`,
            ctaLabel: 'Open route',
            lines: [
              `route: ${payload.route}`,
              `surface: ${payload.surface}`,
              `sentiment: ${payload.sentiment}`,
              `device: ${payload.deviceClass}`,
              `user_id: ${user?.id ?? '(anon)'}`,
              payload.message ? '' : '(no message)',
              payload.message ? `message: ${payload.message}` : '',
            ].filter((l) => l.length > 0),
          })
          const adminClient = createSupabaseAdminClient({ schema: 'api' })
          await Promise.allSettled(
            admins.map((toEmail) =>
              sendEmailDeduped(adminClient, {
                dedupeKey: `admin:feedback:${feedbackId}:${toEmail}`,
                userId: null,
                toEmail,
                fromEmail: from,
                replyTo: SUPPORT_EMAIL,
                subject: email.subject,
                html: email.html,
                text: email.text,
                kind: 'internal',
                template: 'admin_feedback',
                tags: [
                  { name: 'kind', value: 'internal' },
                  { name: 'type', value: 'feedback' },
                ],
                meta: { feedbackId, route: payload.route, surface: payload.surface, sentiment: payload.sentiment },
              })
            )
          )
        }
      } catch {
        // best-effort only
      }

      return ok({ saved: true }, { status: HttpStatus.CREATED }, bridge, rid)
    } catch (e) {
      return fail(
        ErrorCode.INTERNAL_ERROR,
        'Failed to save feedback',
        e instanceof Error ? { message: e.message } : undefined,
        { status: 500 },
        bridge,
        rid
      )
    }
  },
  {
    bodySchema: FeedbackSchema,
  }
)

