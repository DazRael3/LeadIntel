import { NextRequest } from 'next/server'
import { z } from 'zod'
import { ok, fail, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { isE2E } from '@/lib/runtimeFlags'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  domains: z.array(z.string().min(3).max(200)).length(10),
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

  const body = await request.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
  }

    await supabase.from('user_settings').upsert({
      user_id: user.id,
      ideal_customer: 'ICP: B2B SaaS',
      what_you_sell: 'Pipeline and outreach automation',
      digest_enabled: true,
      digest_emails_opt_in: true,
      onboarding_completed: true,
    } as any)

    const leads = parsed.data.domains.map((d) => ({
      user_id: user.id,
      company_url: `https://${d}`,
      company_domain: d,
      company_name: d.split('.')[0] ?? d,
    }))
    await supabase.from('leads').insert(leads as any)

    const { data: firstLead } = await supabase.from('leads').select('id').order('created_at', { ascending: true }).limit(1).maybeSingle()
    if (firstLead?.id) {
      await supabase.from('pitches').insert({
        user_id: user.id,
        lead_id: firstLead.id,
        content: 'E2E pitch draft',
      } as any)
    }

    return ok({ ok: true }, undefined, bridge, requestId)
}

