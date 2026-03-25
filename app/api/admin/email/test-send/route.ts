import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, createCookieBridge, asHttpError } from '@/lib/api/http'
import { isValidAdminToken } from '@/lib/admin/admin-token'
import { getAppUrl } from '@/lib/app-url'
import { getEmailTemplate, type EmailTemplateId } from '@/lib/email/registry'
import { qaEmailTemplate } from '@/lib/email/qa'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendEmailDeduped } from '@/lib/email/send-deduped'
import { serverEnv } from '@/lib/env'
import { getResendReplyToEmail } from '@/lib/email/routing'
import { parseEmailCsv } from '@/lib/lifecycle/config'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  templateId: z.string().trim().min(1).max(64),
  // Defaults to operator allowlist (or lifecycle admin emails). Can be overridden, but still internal-only.
  toEmail: z.string().trim().email().optional(),
  appUrl: z.string().trim().url().optional(),
  dryRun: z.boolean().optional(),
})

function getOperatorAllowlist(): string[] {
  const review = parseEmailCsv(serverEnv.PROSPECT_WATCH_REVIEW_EMAILS)
  const lifecycleAdmins = parseEmailCsv(serverEnv.LIFECYCLE_ADMIN_EMAILS)
  const fallback = parseEmailCsv(serverEnv.FEEDBACK_NOTIFICATION_EMAILS)
  return Array.from(new Set([...review, ...lifecycleAdmins, ...fallback])).filter(Boolean)
}

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

      const templateId = parsed.data.templateId as EmailTemplateId
      const entry = getEmailTemplate(templateId)
      if (!entry) {
        return fail(ErrorCode.NOT_FOUND, 'Template not found', { templateId }, { status: 404 }, bridge, requestId)
      }

      const allowlist = getOperatorAllowlist()
      const toEmail = (parsed.data.toEmail ?? allowlist[0] ?? '').trim().toLowerCase()
      if (!toEmail) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'No operator email configured for test sends',
          { hint: 'Set LIFECYCLE_ADMIN_EMAILS or PROSPECT_WATCH_REVIEW_EMAILS, or provide toEmail explicitly.' },
          { status: 400 },
          bridge,
          requestId
        )
      }
      if (allowlist.length > 0 && !allowlist.includes(toEmail)) {
        return fail(
          ErrorCode.FORBIDDEN,
          'Test sends are restricted to operator allowlist',
          { toEmail, allowlist },
          { status: 403 },
          bridge,
          requestId
        )
      }

      const from = (serverEnv.RESEND_FROM_EMAIL ?? '').trim()
      const hasResend = Boolean((serverEnv.RESEND_API_KEY ?? '').trim()) && Boolean(from)
      if (!hasResend) {
        return ok({ sent: false, status: 'skipped', reason: 'resend_not_configured' }, undefined, bridge, requestId)
      }

      const appUrl = parsed.data.appUrl ?? getAppUrl()
      const rendered = entry.render({ appUrl })
      const issues = qaEmailTemplate({ templateId: entry.meta.id, rendered })

      // Dedupe per template + recipient + day so repeated clicks don't spam.
      const day = new Date().toISOString().slice(0, 10)
      const dedupeKey = `test_send:${entry.meta.id}:${toEmail}:${day}`
      if (parsed.data.dryRun) {
        void logProductEvent({
          userId: null,
          eventName: 'email_lab_test_send_result',
          eventProps: { templateId: entry.meta.id, status: 'skipped', reason: 'dry_run' },
        })
        return ok({ sent: false, status: 'skipped', reason: 'dry_run', qa: { issues } }, undefined, bridge, requestId)
      }

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const res = await sendEmailDeduped(admin, {
        dedupeKey,
        userId: null,
        toEmail,
        fromEmail: from,
        replyTo: getResendReplyToEmail(),
        subject: `[TEST] ${rendered.subject}`,
        html: rendered.html,
        text: rendered.text,
        kind: 'internal',
        template: `test_send:${entry.meta.id}`,
        tags: [
          { name: 'kind', value: 'test_send' },
          { name: 'template_id', value: entry.meta.id },
          { name: 'audience', value: entry.meta.audience },
        ],
        meta: { tool: 'admin_email_test_send', templateId: entry.meta.id },
      })

      void logProductEvent({
        userId: null,
        eventName: 'email_lab_test_send_result',
        eventProps: {
          templateId: entry.meta.id,
          status: res.ok ? res.status : 'failed',
          reason: res.ok ? (res.status === 'skipped' ? res.reason : undefined) : undefined,
        },
      })

      return ok(
        { sent: res.ok && res.status === 'sent', status: res.ok ? res.status : 'failed', ...(res.ok ? { reason: (res as any).reason } : { error: res.error }), qa: { issues } },
        undefined,
        bridge,
        requestId
      )
    } catch (e) {
      return asHttpError(e, '/api/admin/email/test-send', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

