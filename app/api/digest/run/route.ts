import { NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { DigestRunSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { captureBreadcrumb, captureException } from '@/lib/observability/sentry'
import { logError, logInfo, logWarn } from '@/lib/observability/logger'
import { buildUserDigest } from '@/lib/services/digest'
import { renderDailyDigestEmailHtml, renderDailyDigestEmailText } from '@/lib/email/templates'
import { sendEmailWithResend } from '@/lib/email/resend'
import { insertEmailLog } from '@/lib/email/email-logs'

export const dynamic = 'force-dynamic'

async function sendWebhook(url: string, text: string) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export const POST = withApiGuard(
  async (request: NextRequest, { body, isCron, requestId }) => {
    const bridge = createCookieBridge()
    const runCorrelationId = `digest:${requestId ?? new Date().toISOString()}`

    try {
      // Authorization:
      // - Cron: authenticated via X-CRON-SECRET in the guard
      // - Manual/admin: requires x-admin-digest-secret
      if (!isCron) {
        const adminSecret = serverEnv.ADMIN_DIGEST_SECRET
        const headerSecret = request.headers.get('x-admin-digest-secret')
        if (!adminSecret || headerSecret !== adminSecret) {
          return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, undefined, bridge, requestId)
        }
      }

      // Digest operates cross-tenant (reads digest-enabled tenants), so it must use service role.
      const supabase = createSupabaseAdminClient()

      // Find digest-enabled users due now (simple: enabled + any)
      const { data: users, error: usersError } = await supabase
        .from('user_settings')
        .select('user_id, digest_enabled, digest_webhook_url')
        .eq('digest_enabled', true)

      if (usersError) {
        captureException(usersError, { route: '/api/digest/run', requestId, isCron })
        logError({
          scope: 'digest',
          message: 'digest.fetch_users_failed',
          correlationId: runCorrelationId,
          isCron,
        })
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to fetch users', undefined, undefined, bridge, requestId)
      }

      const summaries: { user_id: string; delivered: boolean }[] = []

      type DigestUserRow = { user_id: string; digest_webhook_url?: string | null }
      for (const u of (users || []) as DigestUserRow[]) {
        const userCorrelationId = `${runCorrelationId}:${u.user_id}`
        logInfo({ scope: 'digest', message: 'digest.user_start', userId: u.user_id, correlationId: userCorrelationId })

        // Build digest (best-effort).
        const built = await buildUserDigest({ userId: u.user_id, correlationId: userCorrelationId })
        if (!built.ok) {
          logInfo({
            scope: 'digest',
            message: 'digest.skip',
            userId: u.user_id,
            correlationId: userCorrelationId,
            reason: built.reason,
          })
          summaries.push({ user_id: u.user_id, delivered: false })
          continue
        }

        // Resolve user email (best-effort).
        let toEmail: string | null = null
        try {
          const { data: userRow } = await supabase.from('users').select('email').eq('id', u.user_id).maybeSingle()
          toEmail = (userRow as { email?: string | null } | null)?.email ?? null
        } catch {
          toEmail = null
        }

        // Prepare digest content.
        const brandName = 'LeadIntel'
        const subject = `Your LeadIntel Daily Digest — ${built.summary.dateIso}`
        const html = renderDailyDigestEmailHtml({
          brandName,
          dateIso: built.summary.dateIso,
          summary: {
            highPriorityLeadCount: built.summary.highPriorityLeadCount,
            triggerEventCount: built.summary.triggerEventCount,
          },
          leads: built.summary.leads,
          footerText: 'You are receiving this digest because you enabled digests in LeadIntel Settings.',
        })
        const text = renderDailyDigestEmailText({
          brandName,
          dateIso: built.summary.dateIso,
          summary: {
            highPriorityLeadCount: built.summary.highPriorityLeadCount,
            triggerEventCount: built.summary.triggerEventCount,
          },
          leads: built.summary.leads,
        })

        let delivered = false

        // Webhook delivery (legacy; keep fail-open).
        if (u.digest_webhook_url) {
          try {
            await sendWebhook(u.digest_webhook_url, text)
            delivered = true
          } catch {
            delivered = false
          }
        }

        // Email delivery (new; best-effort, safe for missing config).
        if (toEmail) {
          const fromEmail = serverEnv.RESEND_FROM_EMAIL || 'noreply@leadintel.com'
          const sendRes = await sendEmailWithResend({
            from: fromEmail,
            to: toEmail,
            subject,
            html,
            text,
            tags: [
              { name: 'kind', value: 'digest' },
              { name: 'user_id', value: u.user_id },
              { name: 'corr', value: userCorrelationId },
            ],
          })

          if (sendRes.ok) {
            delivered = true
            await insertEmailLog(supabase as any, {
              userId: u.user_id,
              leadId: null,
              toEmail,
              fromEmail,
              subject,
              provider: 'resend',
              status: 'sent',
              resendMessageId: sendRes.messageId,
              kind: 'digest',
            })
          } else {
            logWarn({
              scope: 'digest',
              message: 'digest.email_send_failed',
              userId: u.user_id,
              correlationId: userCorrelationId,
            })
            await insertEmailLog(supabase as any, {
              userId: u.user_id,
              leadId: null,
              toEmail,
              fromEmail,
              subject,
              provider: 'resend',
              status: 'failed',
              error: sendRes.errorMessage,
              kind: 'digest',
            })
          }
        } else {
          logWarn({
            scope: 'digest',
            message: 'digest.user_email_missing',
            userId: u.user_id,
            correlationId: userCorrelationId,
          })
        }

        try {
          await supabase
            .from('user_settings')
            .update({ digest_last_sent_at: new Date().toISOString() })
            .eq('user_id', u.user_id)
        } catch {
          // Best-effort: schema may not include digest_last_sent_at yet.
          captureBreadcrumb({
            category: 'digest',
            level: 'warning',
            message: 'digest_last_sent_at_update_failed',
            data: { route: '/api/digest/run', requestId, isCron },
          })
        }

        summaries.push({ user_id: u.user_id, delivered })
      }

      const requestedUserId = (body as { userId?: string } | undefined)?.userId ?? null
      return ok({ summaries, requestedUserId }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/digest/run', undefined, bridge, requestId)
    }
  },
  {
    bodySchema: DigestRunSchema.partial(),
  }
)
