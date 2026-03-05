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
})

const policy: RoutePolicy = {
  tier: 'E2E_ADMIN',
  maxBytes: 8192,
  rateLimit: { authPerMin: 0, ipPerMin: 5 },
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

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { code?: string; message?: string; details?: string }
  const code = (e.code ?? '').trim()
  if (code === '42P01' || code === 'PGRST205') return true
  const msg = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase()
  return msg.includes('could not find the table') || msg.includes('does not exist')
}

type DeleteResult = { error: unknown; count: number | null }
type DeleteBuilder = { eq: (column: string, value: string) => Promise<DeleteResult> }
type TableClient = { delete: (args: { count: 'exact' }) => DeleteBuilder }
type MinimalSupabaseClient = { from: (table: string) => TableClient }

async function deleteForUserId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  table: string,
  column: string,
  userId: string
): Promise<number> {
  const client = admin as unknown as MinimalSupabaseClient
  const res = await client.from(table).delete({ count: 'exact' }).eq(column, userId)

  const err = res.error
  const count = res.count ?? 0
  if (err) {
    if (isMissingTableError(err)) return 0
    throw err
  }
  return count
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

  const rl = await checkPolicyRateLimit(request, null, '/api/e2e/reset-user', policy)
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

  try {
    const userId = userRow.id as string

    const deleted = {
      leadTags: await deleteForUserId(admin, 'lead_tags', 'user_id', userId),
      tags: await deleteForUserId(admin, 'tags', 'user_id', userId),
      pitches: await deleteForUserId(admin, 'pitches', 'user_id', userId),
      triggerEvents: await deleteForUserId(admin, 'trigger_events', 'user_id', userId),
      leads: await deleteForUserId(admin, 'leads', 'user_id', userId),
      watchlist: await deleteForUserId(admin, 'watchlist', 'user_id', userId),
      marketWatchlists: await deleteForUserId(admin, 'user_watchlists', 'user_id', userId),
      websiteVisitors: await deleteForUserId(admin, 'website_visitors', 'user_id', userId),
      emailLogs: await deleteForUserId(admin, 'email_logs', 'user_id', userId),
      userSettings: await deleteForUserId(admin, 'user_settings', 'user_id', userId),
    }

    return ok({ ok: true, deleted }, undefined, undefined, requestId)
  } catch {
    return fail(ErrorCode.DATABASE_ERROR, 'Reset failed', undefined, undefined, undefined, requestId)
  }
}

