import { NextRequest } from 'next/server'
import { serverEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { DigestRunSchema } from '@/lib/api/schemas'
import { withApiGuard } from '@/lib/api/guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { captureBreadcrumb, captureException } from '@/lib/observability/sentry'

export const dynamic = 'force-dynamic'

async function sendWebhook(url: string, text: string) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export const POST = withApiGuard(
  async (request: NextRequest, { isCron, requestId }) => {
    const bridge = createCookieBridge()

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

      // Validate request body (optional userId for testing)
      let body
      try {
        body = await validateBody(request, DigestRunSchema.partial(), { maxBytes: 1024 })
      } catch (error) {
        return validationError(error, bridge, requestId)
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
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to fetch users', undefined, undefined, bridge, requestId)
      }

      const summaries: { user_id: string; delivered: boolean }[] = []

      for (const u of users || []) {
        // Fetch last 7d pitches
        const { data: pitches } = await supabase
          .from('pitches')
          .select('content, created_at')
          .eq('user_id', u.user_id)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })

        const lines = [
          `LeadIntel Weekly Digest`,
          `Pitches this week: ${(pitches || []).length}`,
          '',
          ...(pitches || []).slice(0, 5).map((p) => `- ${p.created_at}: ${p.content?.slice(0, 140) || ''}`),
        ].join('\n')

        let delivered = false
        if (u.digest_webhook_url) {
          try {
            await sendWebhook(u.digest_webhook_url, lines)
            delivered = true
          } catch {
            delivered = false
          }
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

      return ok({ summaries, requestedUserId: body?.userId ?? null }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/digest/run', undefined, bridge, requestId)
    }
  },
  {
    bodySchema: DigestRunSchema.partial(),
  }
)
