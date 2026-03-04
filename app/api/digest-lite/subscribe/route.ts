import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, asHttpError, createCookieBridge } from '@/lib/api/http'
import { checkPublicRateLimit } from '@/lib/rateLimit'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  email: z.string().trim().email().max(320),
})

function canPersistSubscribers(): boolean {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim()
  const serviceRole = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim()
  return url.length > 0 && serviceRole.length > 0
}

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const limited = await checkPublicRateLimit({
        request,
        route: '/api/digest-lite/subscribe',
        limit: 5,
        window: '1 h',
        windowMsFallback: 60 * 60 * 1000,
      })
      if (!limited.ok) {
        return fail(
          ErrorCode.RATE_LIMIT_EXCEEDED,
          'Too many subscription requests. Please try again later.',
          { reset: limited.reset },
          { headers: { 'X-RateLimit-Remaining': String(limited.remaining) } },
          bridge,
          requestId
        )
      }

      if (!canPersistSubscribers()) {
        return fail(
          ErrorCode.SERVICE_UNAVAILABLE,
          'Subscriptions are not enabled on this deployment.',
          undefined,
          { status: 503 },
          bridge,
          requestId
        )
      }

      const parsed = body as z.infer<typeof BodySchema>
      const email = parsed.email.toLowerCase()

      const supabase = createSupabaseAdminClient({ schema: 'api' })
      const { error } = await supabase.from('digest_lite_subscribers').insert({ email })
      if (error) {
        // Unique violation (already subscribed) is not an error for this endpoint.
        if (error.code === '23505') {
          return ok({ subscribed: true, already: true }, undefined, bridge, requestId)
        }
        throw error
      }

      return ok({ subscribed: true, already: false }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/digest-lite/subscribe', undefined, bridge, requestId)
    }
  },
  { bodySchema: BodySchema, bypassRateLimit: true }
)

