import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { RecipeInputSchema, updateActionRecipe } from '@/lib/services/action-recipes'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

function extractRecipeIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean)
  const id = parts.at(-1)
  return typeof id === 'string' && id.trim().length > 0 ? id : null
}

const PatchSchema = RecipeInputSchema.partial()

export const PATCH = withApiGuard(async (request: NextRequest, { requestId, userId, body }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'action_queue' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const recipeId = extractRecipeIdFromPath(new URL(request.url).pathname)
    if (!recipeId) return fail(ErrorCode.VALIDATION_ERROR, 'Missing recipe id', undefined, { status: 400 }, bridge, requestId)

    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const recipe = await updateActionRecipe({ supabase, workspaceId: workspace.id, recipeId, input: parsed.data })

    await logAudit({
      supabase,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'action_recipe.updated',
      targetType: 'action_recipe',
      targetId: recipe.id,
      meta: { enabled: recipe.is_enabled },
      request,
    })

    return ok({ recipe }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspace/recipes/[recipeId]', userId, bridge, requestId)
  }
})

