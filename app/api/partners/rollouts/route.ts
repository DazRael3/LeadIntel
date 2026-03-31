import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createTemplateRollout } from '@/lib/services/rollout-workflows'
import { logAudit } from '@/lib/audit/log'
import { logProductEvent } from '@/lib/services/analytics'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  templateId: z.string().uuid(),
  targetWorkspaceIds: z.array(z.string().uuid()).min(1).max(50),
  name: z.string().trim().min(1).max(120).optional().default('Template rollout'),
})

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const { data: jobs } = await supabase
      .schema('api')
      .from('rollout_jobs')
      .select('id, name, status, created_at, meta')
      .eq('source_workspace_id', ws.id)
      .order('created_at', { ascending: false })
      .limit(50)

    const { data: items } = await supabase
      .schema('api')
      .from('rollout_items')
      .select('id, rollout_job_id, target_workspace_id, status, error_sanitized, applied_at, created_at')
      .in(
        'rollout_job_id',
        ((jobs ?? []) as unknown as Array<{ id?: unknown }>).map((j) => j.id).filter((x): x is string => typeof x === 'string')
      )
      .order('created_at', { ascending: false })
      .limit(200)

    return ok({ workspaceId: ws.id, jobs: jobs ?? [], items: items ?? [] }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/partners/rollouts', userId, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'partner_dashboard' })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const res = await createTemplateRollout({
        supabase,
        actorUserId: user.id,
        sourceWorkspaceId: ws.id,
        templateId: parsed.data.templateId,
        targetWorkspaceIds: parsed.data.targetWorkspaceIds,
        name: parsed.data.name,
      })

      if (!res.ok) {
        return fail(res.code === 'FORBIDDEN' ? ErrorCode.FORBIDDEN : ErrorCode.VALIDATION_ERROR, res.message, undefined, undefined, bridge, requestId)
      }

      await logAudit({
        supabase,
        workspaceId: ws.id,
        actorUserId: user.id,
        action: 'rollout.created',
        targetType: 'rollout',
        targetId: res.rolloutJobId,
        meta: { templateId: parsed.data.templateId, targets: parsed.data.targetWorkspaceIds.length, applied: res.applied, skipped: res.skipped, failed: res.failed },
        request,
      })

      await logProductEvent({
        userId: user.id,
        eventName: 'rollout_created',
        eventProps: { workspaceId: ws.id, rolloutJobId: res.rolloutJobId, targets: parsed.data.targetWorkspaceIds.length, applied: res.applied, skipped: res.skipped, failed: res.failed },
      })

      return ok(res, { status: 201 }, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/partners/rollouts', userId, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

