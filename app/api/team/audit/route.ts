import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  action: z.string().trim().min(1).optional(),
  actor: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId, query }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }
      const user = await getUserSafe(supabase)
      if (!user) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const parsedQuery = QuerySchema.safeParse(query ?? {})
      if (!parsedQuery.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsedQuery.error.flatten(), undefined, bridge, requestId)
      }

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
      }

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      let q = supabase
        .schema('api')
        .from('audit_logs')
        .select('id, workspace_id, actor_user_id, action, target_type, target_id, meta, ip, user_agent, created_at')
        .eq('workspace_id', workspace.id)

      if (parsedQuery.data.action) q = q.eq('action', parsedQuery.data.action)
      if (parsedQuery.data.actor) q = q.eq('actor_user_id', parsedQuery.data.actor)
      if (parsedQuery.data.from) q = q.gte('created_at', parsedQuery.data.from)
      if (parsedQuery.data.to) q = q.gte('created_at', parsedQuery.data.to) // inclusive; UI uses end-of-day when needed

      const { data: rows, error } = await q.order('created_at', { ascending: false }).limit(200)
      if (error) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to load audit log', undefined, undefined, bridge, requestId)
      }

      const actorIds = Array.from(
        new Set(
          (rows ?? [])
            .map((r: { actor_user_id?: string | null }) => r.actor_user_id ?? null)
            .filter((v: string | null): v is string => typeof v === 'string' && v.length > 0)
        )
      )

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const [usersRes, settingsRes] = await Promise.all([
        actorIds.length > 0 ? admin.from('users').select('id, email').in('id', actorIds) : Promise.resolve({ data: [], error: null }),
        actorIds.length > 0
          ? admin.from('user_settings').select('user_id, display_name').in('user_id', actorIds)
          : Promise.resolve({ data: [], error: null }),
      ])

      const emailById = new Map<string, string | null>(
        (usersRes.data ?? []).map((r: { id?: string | null; email?: string | null }) => [String(r.id), r.email ?? null])
      )
      const nameById = new Map<string, string | null>(
        (settingsRes.data ?? []).map((r: { user_id?: string | null; display_name?: string | null }) => [
          String(r.user_id),
          r.display_name ?? null,
        ])
      )

      const enriched = (rows ?? []).map((r: any) => ({
        ...r,
        actor: {
          userId: r.actor_user_id,
          email: emailById.get(r.actor_user_id) ?? null,
          displayName: nameById.get(r.actor_user_id) ?? null,
        },
      }))

      return ok({ workspace, logs: enriched }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/audit', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

