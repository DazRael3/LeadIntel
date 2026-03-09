import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { logAudit } from '@/lib/audit/log'
import { requireTeamPlan } from '@/lib/team/gating'
import { createHash, randomBytes } from 'crypto'
import { enqueueWebhookEvent } from '@/lib/integrations/webhooks'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { isInviteAllowed } from '@/lib/domain/workspace-policies'

export const dynamic = 'force-dynamic'

const InviteBodySchema = z.object({
  email: z.string().email().min(3),
  role: z.enum(['admin', 'manager', 'rep', 'viewer']),
})

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
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

      const parsed = InviteBodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
      }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin' && membership.role !== 'manager')) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const { policies } = await getWorkspacePolicies({ supabase, workspaceId: workspace.id })
      const emailNorm = parsed.data.email.trim().toLowerCase()
      if (!isInviteAllowed({ policies, email: emailNorm })) {
        await logAudit({
          supabase,
          workspaceId: workspace.id,
          actorUserId: user.id,
          action: 'invite.denied_by_policy',
          targetType: 'invite',
          targetId: null,
          meta: { email: emailNorm, allowedDomains: policies.invite.allowedDomains ?? [] },
          request,
        })
        return fail(ErrorCode.FORBIDDEN, 'Invite restricted by workspace policy', { email: 'Domain not allowed for this workspace' }, undefined, bridge, requestId)
      }

      const rawToken = randomBytes(24).toString('hex')
      const tokenHash = sha256Hex(rawToken)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

      const { data: invite, error: inviteError } = await supabase
        .schema('api')
        .from('workspace_invites')
        .insert({
          workspace_id: workspace.id,
          email: emailNorm,
          role: parsed.data.role,
          token_hash: tokenHash,
          expires_at: expiresAt,
          created_by: user.id,
        })
        .select('id')
        .single()

      if (inviteError || !invite) {
        return fail(ErrorCode.DATABASE_ERROR, 'Invite failed', undefined, undefined, bridge, requestId)
      }

      await logAudit({
        supabase,
        workspaceId: workspace.id,
        actorUserId: user.id,
        action: 'member.invited',
        targetType: 'invite',
        targetId: null,
        meta: {
          inviteId: invite.id,
          role: parsed.data.role,
          email: emailNorm,
        },
        request,
      })

      await enqueueWebhookEvent({
        workspaceId: workspace.id,
        eventType: 'member.invited',
        eventId: invite.id,
        payload: {
          workspaceId: workspace.id,
          inviteId: invite.id,
          email: emailNorm,
          role: parsed.data.role,
          createdAt: new Date().toISOString(),
        },
      })

      const base = (process.env.NEXT_PUBLIC_SITE_URL ?? request.nextUrl.origin).replace(/\/$/, '')
      const inviteLink = `${base}/settings/team?accept=${rawToken}`

      // Token is returned only at creation time. Store token_hash only.
      return ok(
        {
          inviteId: invite.id,
          inviteLink,
        },
        { status: 201 },
        bridge,
        requestId
      )
    } catch (error) {
      return asHttpError(error, '/api/team/invites', userId, bridge, requestId)
    }
  },
  { bodySchema: InviteBodySchema }
)

