import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { getUserTierForGating } from '@/lib/team/gating'
import { hasCapability } from '@/lib/billing/capabilities'
import { getCurrentWorkspace, getWorkspaceMembership, ensurePersonalWorkspace } from '@/lib/team/workspace'

export const dynamic = 'force-dynamic'

type AngleSetRow = {
  id: string
  title: string
  context: string | null
  tags: string[] | null
  source: string | null
  source_ref: unknown
  created_at: string
  updated_at: string
}

type AngleVariantRow = {
  id: string
  angle_set_id: string
  label: string
  channel: string | null
  angle: string
  opener: string
  why_now_bullets: string[] | null
  limitations: string[] | null
  status: string
  created_at: string
  updated_at: string
}

const CreateSchema = z.object({
  title: z.string().trim().min(2).max(120),
  context: z.string().trim().max(2000).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(24)).max(12).optional().default([]),
  source: z.string().trim().max(40).nullable().optional(),
  sourceRef: z.record(z.string(), z.unknown()).optional().default({}),
  variants: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(32),
        channel: z.enum(['email', 'linkedin_dm', 'call_opener']).nullable().optional(),
        angle: z.string().trim().min(1).max(2000),
        opener: z.string().trim().min(1).max(5000),
        whyNowBullets: z.array(z.string().trim().min(1).max(240)).max(20).optional().default([]),
        limitations: z.array(z.string().trim().min(1).max(240)).max(20).optional().default([]),
      })
    )
    .min(1)
    .max(10),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!hasCapability(tier, 'angle_library')) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return ok({ angles: [], workspace: { id: '', name: 'Workspace' } }, undefined, bridge, requestId)
    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data: sets } = await supabase
      .schema('api')
      .from('angle_sets')
      .select('id, title, context, tags, source, source_ref, created_at, updated_at')
      .eq('workspace_id', ws.id)
      .order('updated_at', { ascending: false })
      .limit(100)

    const angleSets = (sets ?? []) as unknown as AngleSetRow[]
    const setIds = angleSets.map((s: AngleSetRow) => s.id).filter(Boolean)
    const { data: variants } = setIds.length
      ? await supabase
          .schema('api')
          .from('angle_variants')
          .select('id, angle_set_id, label, channel, angle, opener, why_now_bullets, limitations, status, created_at, updated_at')
          .eq('workspace_id', ws.id)
          .in('angle_set_id', setIds)
          .order('created_at', { ascending: false })
          .limit(500)
      : { data: [] as unknown[] }

    const angleVariants = (variants ?? []) as unknown as AngleVariantRow[]

    return ok(
      {
        workspace: { id: ws.id, name: ws.name },
        angles: angleSets.map((s: AngleSetRow) => ({
          id: s.id,
          title: s.title,
          context: s.context,
          tags: Array.isArray(s.tags) ? s.tags : [],
          source: s.source,
          sourceRef: (s.source_ref && typeof s.source_ref === 'object' ? (s.source_ref as Record<string, unknown>) : {}) ?? {},
          createdAt: s.created_at,
          updatedAt: s.updated_at,
          variants: angleVariants
            .filter((v: AngleVariantRow) => v.angle_set_id === s.id)
            .map((v: AngleVariantRow) => ({
              id: v.id,
              label: v.label,
              channel: typeof v.channel === 'string' ? v.channel : null,
              angle: v.angle,
              opener: v.opener,
              whyNowBullets: Array.isArray(v.why_now_bullets) ? v.why_now_bullets : [],
              limitations: Array.isArray(v.limitations) ? v.limitations : [],
              status: v.status,
              createdAt: v.created_at,
              updatedAt: v.updated_at,
            })),
        })),
      },
      undefined,
      bridge,
      requestId
    )
  } catch (e) {
    return asHttpError(e, '/api/angles', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const supabase = createRouteClient(request, bridge)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const tier = await getUserTierForGating({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!hasCapability(tier, 'angle_library')) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      if (!hasCapability(tier, 'angle_variants')) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const { data: setRow, error: setErr } = await supabase
        .schema('api')
        .from('angle_sets')
        .insert(
          {
            workspace_id: ws.id,
            created_by: user.id,
            title: parsed.data.title,
            context: parsed.data.context ?? null,
            tags: parsed.data.tags,
            source: parsed.data.source ?? null,
            source_ref: parsed.data.sourceRef,
          } as never,
          { count: 'exact' }
        )
        .select('id')
        .single()

      if (setErr || !setRow) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to save angle set', undefined, undefined, bridge, requestId)
      }
      const angleSetId = (setRow as { id?: unknown } | null)?.id
      if (typeof angleSetId !== 'string' || !angleSetId) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to save angle set', undefined, undefined, bridge, requestId)
      }

      const variantRows = parsed.data.variants.map((v) => ({
        workspace_id: ws.id,
        angle_set_id: angleSetId,
        created_by: user.id,
        label: v.label,
        channel: v.channel ?? null,
        angle: v.angle,
        opener: v.opener,
        why_now_bullets: v.whyNowBullets,
        limitations: v.limitations,
        status: 'active',
      }))

      const { error: variantErr } = await supabase.schema('api').from('angle_variants').insert(variantRows as never)
      if (variantErr) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to save angle variants', undefined, undefined, bridge, requestId)
      }

      return ok({ angleSetId }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/angles', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

