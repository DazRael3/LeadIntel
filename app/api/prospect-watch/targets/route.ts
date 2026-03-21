import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  companyDomain: z.string().trim().min(3).max(180).optional(),
  websiteUrl: z.string().trim().url().optional(),
  icpNotes: z.string().trim().max(800).optional(),
  icpFitScore: z.number().int().min(0).max(100).optional(),
})

function isPrivileged(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export const POST = withApiGuard(
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

      const parsed = CreateSchema.safeParse(body)
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid payload', parsed.error.flatten(), { status: 400 }, bridge, requestId)

      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.VALIDATION_ERROR, 'Workspace required', { reason: 'workspace_missing' }, { status: 422 }, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      const role = membership?.role ?? null
      if (!membership || !isPrivileged(role)) return fail(ErrorCode.FORBIDDEN, 'Admin access required', { role }, { status: 403 }, bridge, requestId)

      const companyDomain = parsed.data.companyDomain?.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0] ?? undefined

      const client = supabase.schema('api')
      const { data: created, error: insErr } = await client
        .from('prospect_watch_targets')
        .insert({
          workspace_id: ws.id,
          created_by: user.id,
          status: 'active',
          company_name: parsed.data.companyName,
          company_domain: companyDomain ?? null,
          website_url: parsed.data.websiteUrl ?? null,
          icp_notes: parsed.data.icpNotes ?? null,
          icp_fit_manual_score: parsed.data.icpFitScore ?? 50,
        })
        .select('id')
        .maybeSingle()
      if (insErr || !(created as { id?: string } | null)?.id) {
        return fail(ErrorCode.DATABASE_ERROR, 'Create failed', { message: insErr?.message ?? 'unknown' }, { status: 500 }, bridge, requestId)
      }

      return ok({ created: true, id: (created as any).id }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/prospect-watch/targets', undefined, bridge, requestId)
    }
  },
  { bodySchema: CreateSchema }
)

