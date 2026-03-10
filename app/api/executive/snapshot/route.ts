import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireTeamPlan } from '@/lib/team/gating'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { buildExecutiveSummary } from '@/lib/executive/engine'
import { logProductEvent } from '@/lib/services/analytics'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  format: z.enum(['markdown']).default('markdown'),
})

function mdSnapshot(args: { workspaceName: string; summary: Awaited<ReturnType<typeof buildExecutiveSummary>> }): string {
  const s = args.summary
  const m = s.metrics
  const lines: string[] = []
  lines.push(`# Executive snapshot — ${args.workspaceName}`)
  lines.push('')
  lines.push(`Generated: ${new Date(s.computedAt).toLocaleString()}`)
  lines.push('')
  lines.push('## Key metrics')
  lines.push(`- Ready actions: ${m.actionQueueReady}`)
  lines.push(`- Blocked/failed actions: ${m.actionQueueBlocked}`)
  lines.push(`- Approvals pending: ${m.approvalsPending}`)
  lines.push(`- Delivery failures (7d): ${m.deliveriesFailed7d}`)
  lines.push(`- Strategic/named programs: ${m.strategicPrograms}`)
  lines.push('')
  lines.push('## Highlights')
  for (const h of s.highlights.slice(0, 6)) lines.push(`- **${h.title}**: ${h.detail}`)
  lines.push('')
  lines.push('## Risks / blockers')
  if (s.risks.length === 0) lines.push('- None observed in the current summary window.')
  for (const r of s.risks.slice(0, 8)) lines.push(`- **${r.title}**: ${r.detail}`)
  lines.push('')
  lines.push('## Method note')
  lines.push(s.limitationsNote)
  lines.push('')
  return lines.join('\n')
}

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

      const parsed = BodySchema.safeParse(body ?? {})
      if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const ws = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!ws) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

      const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
      if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: ws.id })
      if (!policies.reporting.executiveEnabled || !policies.reporting.snapshotsEnabled) {
        return fail(ErrorCode.FORBIDDEN, 'Executive snapshots are disabled for this workspace', undefined, undefined, bridge, requestId)
      }
      const canView = policies.reporting.executiveViewerRoles.includes(membership.role)
      if (!canView) return fail(ErrorCode.FORBIDDEN, 'Manager access required', undefined, undefined, bridge, requestId)

      const summary = await buildExecutiveSummary({ supabase, workspaceId: ws.id })
      const markdown = mdSnapshot({ workspaceName: ws.name, summary })
      await logProductEvent({ userId: user.id, eventName: 'executive_snapshot_generated', eventProps: { workspaceId: ws.id, format: parsed.data.format } })

      return ok({ workspace: { id: ws.id, name: ws.name }, snapshot: { format: 'markdown', markdown } }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/executive/snapshot', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

