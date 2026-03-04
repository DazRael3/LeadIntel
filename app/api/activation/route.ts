import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, createCookieBridge, asHttpError } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { buildActivationState } from '@/lib/growth/activation'

export const dynamic = 'force-dynamic'

type UserSettingsRow = {
  ideal_customer?: string | null
  what_you_sell?: string | null
  digest_enabled?: boolean | null
  digest_emails_opt_in?: boolean | null
  checklist_completed_at?: string | null
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const { data: settingsRow } = await supabase
      .from('user_settings')
      .select('ideal_customer, what_you_sell, digest_enabled, digest_emails_opt_in, checklist_completed_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const settings = (settingsRow ?? null) as UserSettingsRow | null
    const icpConfigured = Boolean((settings?.ideal_customer ?? '').trim() || (settings?.what_you_sell ?? '').trim())
    const digestCadenceOn = Boolean(settings?.digest_enabled) && (settings?.digest_emails_opt_in ?? true) === true
    const checklistCompletedAt = (settings?.checklist_completed_at ?? null) || null

    // Counts (server-derived; client cannot mark completion)
    const [{ count: accountsCount }, { count: pitchesCount }] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('pitches').select('id', { count: 'exact', head: true }),
    ])

    const activation = buildActivationState({
      icpConfigured,
      accountsCount: typeof accountsCount === 'number' ? accountsCount : 0,
      pitchesCount: typeof pitchesCount === 'number' ? pitchesCount : 0,
      digestCadenceOn,
      checklistCompletedAt,
    })

    // Persist derived snapshot (best-effort) + completion timestamp when first reaching 4/4.
    try {
      const nowIso = new Date().toISOString()
      const nextCompletedAt = activation.completed && !checklistCompletedAt ? nowIso : checklistCompletedAt
      await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            checklist_state: {
              updatedAt: nowIso,
              steps: activation.steps.map((s) => ({ id: s.id, completed: s.completed })),
              counts: activation.counts,
            },
            ...(nextCompletedAt ? { checklist_completed_at: nextCompletedAt } : {}),
            updated_at: nowIso,
          } as unknown as Record<string, unknown>,
          { onConflict: 'user_id' }
        )
        .select('user_id')
        .maybeSingle()
    } catch {
      // best-effort: never fail the response
    }

    return ok({ activation }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/activation', undefined, bridge, requestId)
  }
})

