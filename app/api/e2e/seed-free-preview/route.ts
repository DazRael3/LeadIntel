import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { isE2E } from '@/lib/runtimeFlags'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  companyDomain: z.string().min(3).max(200).default('e2e-preview.example.com'),
  companyName: z.string().min(2).max(200).default('E2E Preview Co'),
})

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  const requestId = request.headers.get('x-request-id') || new Date().toISOString()
  if (!isE2E()) {
    return fail(ErrorCode.NOT_FOUND, 'Route not found', undefined, { status: 404 }, bridge, requestId)
  }

  const supabase = createRouteClient(request, bridge)
  const user = await getUserSafe(supabase)
  if (!user) {
    return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
  }

  const body = await request.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
  }

  const leadId = randomUUID()
  const pitchId = randomUUID()

  await supabase.from('leads').insert({
    id: leadId,
    user_id: user.id,
    company_domain: parsed.data.companyDomain,
    company_name: parsed.data.companyName,
    company_url: `https://${parsed.data.companyDomain}`,
  } as never)

  await supabase.from('pitches').insert({
    id: pitchId,
    user_id: user.id,
    lead_id: leadId,
    content: 'E2E pitch preview content',
  } as never)

  // Record shared preview usage accurately using the same DB RPCs as production.
  // Note: these RPCs enforce the shared cap; for E2E we only seed a single completion.
  const { data: reservationId } = await supabase.rpc('reserve_premium_generation', { expires_seconds: 900 })
  if (typeof reservationId === 'string') {
    await supabase.rpc('complete_premium_generation', {
      p_reservation_id: reservationId,
      p_object_type: 'pitch',
      p_object_id: pitchId,
    })
  }

  return ok({ pitchId, leadId }, undefined, bridge, requestId)
}

