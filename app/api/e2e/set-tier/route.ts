import { NextRequest } from 'next/server'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { ok, fail, ErrorCode } from '@/lib/api/http'
import { timingSafeEqualAscii } from '@/lib/api/cron-auth'
import { checkPolicyRateLimit } from '@/lib/api/ratelimit-policy'
import type { RoutePolicy } from '@/lib/api/policy'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  email: z.string().email().max(320),
  subscription_tier: z.enum(['pro', 'team', 'closer_plus']).nullable(),
})

const policy: RoutePolicy = {
  tier: 'E2E_ADMIN',
  maxBytes: 4096,
  rateLimit: { authPerMin: 0, ipPerMin: 10 },
  originRequired: false,
  authRequired: false,
  cronAllowed: false,
  devOnly: false,
  webhookSignatureRequired: false,
}

function e2eEnabled(): boolean {
  return (process.env.E2E_MODE ?? '').trim() === 'true'
}

function isTokenValid(provided: string | null, expected: string): boolean {
  if (!provided) return false
  return timingSafeEqualAscii(provided, expected)
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-request-id') || new Date().toISOString()

  if (!e2eEnabled()) {
    return fail(ErrorCode.NOT_FOUND, 'Route not found', undefined, { status: 404 }, undefined, requestId)
  }

  const expected = (process.env.E2E_TOKEN ?? '').trim()
  if (!expected) {
    return fail(ErrorCode.SERVICE_UNAVAILABLE, 'E2E token not configured', undefined, { status: 503 }, undefined, requestId)
  }

  const provided = request.headers.get('x-e2e-token')
  if (!isTokenValid(provided, expected)) {
    return fail(ErrorCode.UNAUTHORIZED, 'Missing or invalid x-e2e-token header', undefined, { status: 401 }, undefined, requestId)
  }

  const rl = await checkPolicyRateLimit(request, null, '/api/e2e/set-tier', policy)
  if (rl && !rl.success) {
    return fail(ErrorCode.RATE_LIMIT_EXCEEDED, 'Too many requests', undefined, { status: 429 }, undefined, requestId)
  }

  const rawBody = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, undefined, requestId)
  }

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const email = parsed.data.email.trim()

  const { data: userRow, error: userError } = await admin
    .from('users')
    .select('id, email')
    .ilike('email', email)
    .maybeSingle()

  if (userError) {
    return fail(ErrorCode.DATABASE_ERROR, 'Failed to resolve user', undefined, undefined, undefined, requestId)
  }
  if (!userRow?.id) {
    return fail(ErrorCode.NOT_FOUND, 'User not found', undefined, { status: 404 }, undefined, requestId)
  }

  const { error: updateError } = await admin
    .from('users')
    .update({ subscription_tier: parsed.data.subscription_tier })
    .eq('id', userRow.id)

  if (updateError) {
    return fail(ErrorCode.DATABASE_ERROR, 'Failed to update tier', undefined, undefined, undefined, requestId)
  }

  return ok({ ok: true }, undefined, undefined, requestId)
}

