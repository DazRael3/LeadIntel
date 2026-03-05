import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { logAudit } from '@/lib/audit/log'
import { enqueueWebhookEvent } from '@/lib/integrations/webhooks'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  id: z.string().uuid(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const nowIso = new Date().toISOString()
      const { data: template, error } = await supabase
        .schema('api')
        .from('templates')
        .update({ status: 'approved', approved_by: user.id, approved_at: nowIso })
        .eq('id', parsed.data.id)
        .eq('workspace_id', workspace.id)
        .select(
          'id, workspace_id, set_id, slug, title, channel, trigger, persona, length, subject, body, tokens, status, created_by, approved_by, approved_at, created_at'
        )
        .single()

      if (error || !template) return fail(ErrorCode.DATABASE_ERROR, 'Approve failed', undefined, undefined, bridge, requestId)

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'template.approved',
        targetType: 'template',
        targetId: template.id,
        meta: { slug: template.slug },
        request,
      })

      await enqueueWebhookEvent({
        workspaceId: workspace.id,
        eventType: 'template.approved',
        eventId: template.id,
        payload: {
          workspaceId: workspace.id,
          templateId: template.id,
          slug: template.slug,
          channel: template.channel,
          approvedAt: template.approved_at,
        },
      })

      return ok({ template }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/team/templates/approve', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

