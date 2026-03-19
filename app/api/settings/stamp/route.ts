import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'

export const dynamic = 'force-dynamic'

const StampSchema = z
  .object({
    pricing_viewed_at: z.string().datetime().optional(),
    trust_viewed_at: z.string().datetime().optional(),
    scoring_viewed_at: z.string().datetime().optional(),
    templates_viewed_at: z.string().datetime().optional(),
  })
  .strict()

type SupabaseWriteError = { code?: string; message?: string; details?: string | null; hint?: string | null }

function looksLikeSchemaDrift(error: SupabaseWriteError): boolean {
  const msg = (error.message ?? '').toLowerCase()
  return (
    msg.includes('schema cache') ||
    msg.includes('could not find') ||
    msg.includes('does not exist') ||
    error.code === 'PGRST204' ||
    error.code === '42P01' ||
    (error.hint ?? '').toLowerCase().includes('schema cache')
  )
}

function looksLikeRls(error: SupabaseWriteError): boolean {
  const msg = (error.message ?? '').toLowerCase()
  const code = (error.code ?? '').toLowerCase()
  return (
    code === '42501' ||
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('insufficient privilege')
  )
}

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)

    const user = await getUserSafe(supabase)
    if (!user) return ok({ saved: false, skipped: true, reason: 'unauthenticated' }, undefined, bridge, requestId)

    const parsed = StampSchema.safeParse(body)
    if (!parsed.success) return ok({ saved: false, skipped: true, reason: 'invalid_payload' }, undefined, bridge, requestId)

    const input = parsed.data
    const keys = Object.keys(input)
    if (keys.length === 0) return ok({ saved: false, skipped: true, reason: 'no_fields' }, undefined, bridge, requestId)

    const patch: Record<string, unknown> = {}
    for (const k of keys) {
      const v = (input as Record<string, unknown>)[k]
      if (typeof v === 'string') patch[k] = v
    }
    if (Object.keys(patch).length === 0) return ok({ saved: false, skipped: true, reason: 'no_fields' }, undefined, bridge, requestId)

    const { error } = await supabase
      .schema('api')
      .from('user_settings')
      .upsert(
        {
          user_id: user.id,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )

    if (error) {
      const e = error as SupabaseWriteError
      if (looksLikeSchemaDrift(e)) return ok({ saved: false, skipped: true, reason: 'schema_drift' }, undefined, bridge, requestId)
      if (looksLikeRls(e)) return ok({ saved: false, skipped: true, reason: 'forbidden' }, undefined, bridge, requestId)
      return ok({ saved: false, skipped: true, reason: 'error' }, undefined, bridge, requestId)
    }

    return ok({ saved: true }, undefined, bridge, requestId)
  },
  { bodySchema: StampSchema }
)

