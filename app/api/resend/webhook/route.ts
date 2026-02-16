import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode } from '@/lib/api/http'
import { serverEnv } from '@/lib/env'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { verifyResendWebhookSignature } from '@/lib/email/resend-webhook'
import { captureBreadcrumb, captureException, captureMessage } from '@/lib/observability/sentry'
import { isFeatureEnabled } from '@/lib/services/feature-flags'
import { recordCounter } from '@/lib/observability/metrics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type ResendWebhookEvent = {
  type?: string
  data?: {
    id?: string
    email_id?: string
    to?: string | string[]
  }
}

function extractResendMessageId(event: ResendWebhookEvent): string | null {
  const candidate = event.data?.email_id || event.data?.id
  if (typeof candidate === 'string' && candidate.length > 0) return candidate
  return null
}

function mapResendStatus(eventType: string | undefined): string | null {
  if (!eventType) return null
  // Conservative mapping; unknown types are ignored.
  if (eventType.includes('delivered')) return 'delivered'
  if (eventType.includes('bounced')) return 'bounced'
  if (eventType.includes('failed')) return 'failed'
  if (eventType.includes('sent')) return 'sent'
  return null
}

export const POST = withApiGuard(
  async (_request: NextRequest, { body, requestId }) => {
    try {
      recordCounter('webhook.resend.total', 1)

      if (!(await isFeatureEnabled('resend_webhook'))) {
        captureBreadcrumb({
          category: 'feature_flag',
          level: 'warning',
          message: 'resend_webhook_disabled',
          data: { route: '/api/resend/webhook', requestId },
        })
        // Signature was already verified by guard; we intentionally ACK without DB writes.
        return ok({ received: true, disabled: true }, undefined, undefined, requestId)
      }

      const event = body as ResendWebhookEvent
      const messageId = extractResendMessageId(event)
      const status = mapResendStatus(event.type)

      captureBreadcrumb({
        category: 'webhook',
        level: 'info',
        message: 'resend_webhook_received',
        data: {
          route: '/api/resend/webhook',
          requestId,
          eventType: event.type || 'unknown',
          hasMessageId: Boolean(messageId),
        },
      })

      if (!messageId || !status) {
        // Valid webhook, but not actionable for our current analytics.
        return ok({ received: true }, undefined, undefined, requestId)
      }

      const supabaseAdmin = createSupabaseAdminClient()

      // Attempt to correlate to an email log row. This requires migrations that add resend_message_id.
      // We keep this best-effort to avoid breaking webhook delivery if schema is behind.
      let correlated:
        | { user_id: string; lead_id: string | null }
        | null = null

      try {
        const { data } = await supabaseAdmin
          .from('email_logs')
          .select('user_id, lead_id')
          .eq('resend_message_id', messageId)
          .maybeSingle()
        if (data) correlated = data
      } catch {
        // Ignore: schema may not include resend_message_id yet
      }

      // Update email log status (best-effort).
      try {
        await supabaseAdmin
          .from('email_logs')
          .update({ status })
          .eq('resend_message_id', messageId)
      } catch {
        // Ignore schema mismatch
      }

      // Insert engagement row (best-effort).
      if (correlated) {
        try {
          await supabaseAdmin.from('email_engagement').insert({
            user_id: correlated.user_id,
            lead_id: correlated.lead_id,
            provider: 'resend',
            provider_message_id: messageId,
            event_type: event.type || status,
            occurred_at: new Date().toISOString(),
          })
        } catch {
          // Ignore: engagement table may not exist yet
        }
      }

      return ok({ received: true }, undefined, undefined, requestId)
    } catch (error) {
      recordCounter('webhook.resend.error', 1)
      captureException(error, { route: '/api/resend/webhook', requestId, provider: 'resend' })
      return asHttpError(error, '/api/resend/webhook', undefined, undefined, requestId)
    }
  },
  {
    verifyWebhookSignature: async ({ request, rawBody }) => {
      const secret = serverEnv.RESEND_WEBHOOK_SECRET
      if (!secret) {
        captureMessage('resend_webhook_missing_secret', { route: '/api/resend/webhook' })
        return false
      }
      // Important: verify against raw body before JSON parsing
      const ok = verifyResendWebhookSignature({
        secret,
        rawBody,
        headers: Object.fromEntries(request.headers.entries()),
      })
      if (!ok) {
        recordCounter('webhook.resend.signature_invalid', 1)
        captureMessage('resend_webhook_invalid_signature', { route: '/api/resend/webhook' })
      }
      return ok
    },
  }
)

