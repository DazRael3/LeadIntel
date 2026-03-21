import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { captureServerEvent } from '@/lib/analytics/posthog-server'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['reviewed', 'approved', 'rejected', 'archived']),
})

function isPrivileged(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export const PATCH = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const supabase = createRouteClient(request, bridge)
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (error || !user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, { status: 401 }, bridge, requestId)

      const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
      if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Team plan required', undefined, { status: 403 }, bridge, requestId)

      const parsed = PatchSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)

      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.VALIDATION_ERROR, 'Workspace required', { reason: 'workspace_missing' }, { status: 422 }, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      const role = membership?.role ?? null
      if (!membership || !isPrivileged(role)) return fail(ErrorCode.FORBIDDEN, 'Admin access required', { role }, { status: 403 }, bridge, requestId)

      const client = supabase.schema('api')
      const { error: updErr } = await client
        .from('prospect_watch_prospects')
        .update({ status: parsed.data.status, reviewer_user_id: user.id })
        .eq('workspace_id', ws.id)
        .eq('id', parsed.data.id)
      if (updErr) return fail(ErrorCode.DATABASE_ERROR, 'Update failed', { message: updErr.message }, { status: 500 }, bridge, requestId)

      void captureServerEvent({ distinctId: user.id, event: `prospect_${parsed.data.status}`, properties: { prospectId: parsed.data.id, workspaceId: ws.id } })
      return ok({ updated: true }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/prospect-watch/prospects', undefined, bridge, requestId)
    }
  },
  { bodySchema: PatchSchema }
)

