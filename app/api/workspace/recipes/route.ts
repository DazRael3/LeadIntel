import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { RecipeInputSchema, createActionRecipe, listActionRecipes } from '@/lib/services/action-recipes'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) {
      return ok({ configured: false, reason: 'workspace_missing', role: 'viewer', recipes: [] }, undefined, bridge, requestId)
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const recipes = await listActionRecipes({ supabase, workspaceId: workspace.id })
    return ok({ role: membership.role, recipes }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/recipes', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(async (request: NextRequest, { requestId, userId, body }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parsed = RecipeInputSchema.safeParse(body)
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) {
      return fail(
        ErrorCode.VALIDATION_ERROR,
        'Workspace required',
        { workspace: 'Create or select a workspace before managing action recipes.' },
        { status: 422 },
        bridge,
        requestId
      )
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const recipe = await createActionRecipe({ supabase, workspaceId: workspace.id, userId: user.id, input: parsed.data })

    await logAudit({
      supabase,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'action_recipe.created',
      targetType: 'action_recipe',
      targetId: recipe.id,
      meta: { trigger: recipe.trigger_type, action: recipe.action_type, enabled: recipe.is_enabled },
      request,
    })

    await logProductEvent({
      userId: user.id,
      eventName: 'action_recipe_created',
      eventProps: { workspaceId: workspace.id, recipeId: recipe.id, trigger: recipe.trigger_type, action: recipe.action_type },
    })

    return ok({ recipe }, { status: 201 }, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/recipes', userId, bridge, requestId)
  }
})

