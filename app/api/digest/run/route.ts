import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { serverEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { DigestRunSchema } from '@/lib/api/schemas'

export const dynamic = 'force-dynamic'

async function sendWebhook(url: string, text: string) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    // Admin-protected endpoint
    const adminSecret = serverEnv.ADMIN_DIGEST_SECRET
    const headerSecret = request.headers.get('x-admin-digest-secret')
    if (!adminSecret || headerSecret !== adminSecret) {
      return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, undefined, bridge)
    }

    // Validate request body (optional userId for testing)
    let body
    try {
      body = await validateBody(request, DigestRunSchema.partial(), { maxBytes: 1024 })
    } catch (error) {
      return validationError(error, bridge)
    }

    const supabase = createRouteClient(request, bridge)

    // Find digest-enabled users due now (simple: enabled + any)
    const { data: users, error: usersError } = await supabase
      .from('user_settings')
      .select('user_id, digest_enabled, digest_webhook_url')
      .eq('digest_enabled', true)

    if (usersError) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to fetch users', undefined, undefined, bridge)
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
      ...(pitches || []).slice(0, 5).map(p => `- ${p.created_at}: ${p.content?.slice(0, 140) || ''}`),
    ].join('\n')

    let delivered = false
    if (u.digest_webhook_url) {
      try {
        await sendWebhook(u.digest_webhook_url, lines)
        delivered = true
      } catch (e) {
        delivered = false
      }
    }

    await supabase
      .from('user_settings')
      .update({ digest_last_sent_at: new Date().toISOString() })
      .eq('user_id', u.user_id)

    summaries.push({ user_id: u.user_id, delivered })
  }

    return ok({ summaries }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/digest/run', undefined, bridge)
  }
}
