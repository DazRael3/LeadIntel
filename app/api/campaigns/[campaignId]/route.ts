import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import {
  CampaignAttachLeadsSchema,
  type CampaignRow,
  CampaignUpdateSchema,
  canManageCampaign,
  detachLeadFromCampaign,
  getCampaignById,
  getOwnedLeadRows,
  listCampaignLeadJoins,
  updateCampaignRecord,
  deleteCampaignRecord,
  attachLeadsToCampaign,
} from '@/lib/services/campaigns'
import type { User } from '@supabase/supabase-js'
import { requireCapability } from '@/lib/billing/require-capability'

export const dynamic = 'force-dynamic'

const CampaignIdSchema = z.string().uuid('Invalid campaign id')

const CampaignPatchSchema = CampaignUpdateSchema.refine(
  (value) => value.name !== undefined || value.objective !== undefined || value.status !== undefined,
  { message: 'At least one field must be provided.' }
)

const CampaignPostActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('attach_leads'),
    leadIds: CampaignAttachLeadsSchema.shape.leadIds,
  }),
  z.object({
    action: z.literal('detach_lead'),
    leadId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('export'),
  }),
])

type RouteSupabase = ReturnType<typeof createRouteClient>
type WorkspaceMembership = Awaited<ReturnType<typeof getWorkspaceMembership>>
type Workspace = NonNullable<Awaited<ReturnType<typeof getCurrentWorkspace>>>

type CampaignContextSuccess = {
  ok: true
  bridge: ReturnType<typeof createCookieBridge>
  user: User
  supabase: RouteSupabase
  workspace: Workspace
  membership: NonNullable<WorkspaceMembership>
  campaign: CampaignRow
}

type CampaignContextError = {
  ok: false
  bridge: ReturnType<typeof createCookieBridge>
  response: ReturnType<typeof fail>
}

async function resolveCampaignContext(args: {
  request: NextRequest
  campaignId: string
  requestId: string
}): Promise<CampaignContextSuccess | CampaignContextError> {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(args.request, bridge)
  const user = await getUserSafe(supabase)
  if (!user) {
    return {
      ok: false,
      bridge,
      response: fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, args.requestId),
    }
  }

  await ensurePersonalWorkspace({ supabase, userId: user.id })
  const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
  if (!workspace) {
    return {
      ok: false,
      bridge,
      response: fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, args.requestId),
    }
  }

  const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
  if (!membership) {
    return {
      ok: false,
      bridge,
      response: fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, args.requestId),
    }
  }

  const capability = await requireCapability({
    userId: user.id,
    sessionEmail: user.email ?? null,
    supabase,
    capability: 'action_queue',
  })
  if (!capability.ok) {
    return {
      ok: false,
      bridge,
      response: fail(ErrorCode.FORBIDDEN, 'Campaign workflows require a paid plan', undefined, undefined, bridge, args.requestId),
    }
  }

  const campaign = await getCampaignById({
    supabase,
    workspaceId: workspace.id,
    campaignId: args.campaignId,
  })
  if (!campaign) {
    return {
      ok: false,
      bridge,
      response: fail(ErrorCode.NOT_FOUND, 'Campaign not found', undefined, { status: 404 }, bridge, args.requestId),
    }
  }

  return {
    ok: true,
    bridge,
    user,
    supabase,
    workspace,
    membership,
    campaign,
  }
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId: rawCampaignId } = await ctx.params
  const parsedCampaignId = CampaignIdSchema.safeParse(rawCampaignId)
  if (!parsedCampaignId.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Invalid campaign id')
  }
  const campaignId = parsedCampaignId.data

  const GET_HANDLER = withApiGuard(async (guardRequest, { requestId, userId }) => {
    try {
      if (!userId) {
        const bridge = createCookieBridge()
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const context = await resolveCampaignContext({
        request: guardRequest,
        campaignId,
        requestId,
      })
      if (!context.ok) return context.response

      const joins = await listCampaignLeadJoins({
        supabase: context.supabase,
        workspaceId: context.workspace.id,
        campaignId: context.campaign.id,
      })
      const leadRows = await getOwnedLeadRows({
        supabase: context.supabase,
        userId: context.user.id,
        leadIds: joins.map((join) => join.lead_id),
      })

      return ok(
        {
          workspace: context.workspace,
          campaign: context.campaign,
          leadCount: joins.length,
          leads: leadRows,
        },
        undefined,
        context.bridge,
        requestId
      )
    } catch (error) {
      const bridge = createCookieBridge()
      return asHttpError(error, '/api/campaigns/[campaignId]', userId ?? undefined, bridge, requestId)
    }
  })

  return GET_HANDLER(request)
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId: rawCampaignId } = await ctx.params
  const parsedCampaignId = CampaignIdSchema.safeParse(rawCampaignId)
  if (!parsedCampaignId.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Invalid campaign id')
  }
  const campaignId = parsedCampaignId.data

  const PATCH_HANDLER = withApiGuard(
    async (guardRequest, { requestId, userId, body }) => {
      try {
        if (!userId) {
          const bridge = createCookieBridge()
          return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
        }

        const parsed = body as z.infer<typeof CampaignPatchSchema>

        const context = await resolveCampaignContext({
          request: guardRequest,
          campaignId,
          requestId,
        })
        if (!context.ok) return context.response

        if (!canManageCampaign(context.membership.role, context.campaign.created_by, context.user.id)) {
          return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, context.bridge, requestId)
        }

        const updated = await updateCampaignRecord({
          supabase: context.supabase,
          workspaceId: context.workspace.id,
          campaignId: context.campaign.id,
          patch: parsed,
        })

        return ok({ workspace: context.workspace, campaign: updated }, undefined, context.bridge, requestId)
      } catch (error) {
        const bridge = createCookieBridge()
        return asHttpError(error, '/api/campaigns/[campaignId]', userId ?? undefined, bridge, requestId)
      }
    },
    { bodySchema: CampaignPatchSchema }
  )

  return PATCH_HANDLER(request)
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId: rawCampaignId } = await ctx.params
  const parsedCampaignId = CampaignIdSchema.safeParse(rawCampaignId)
  if (!parsedCampaignId.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Invalid campaign id')
  }
  const campaignId = parsedCampaignId.data

  const DELETE_HANDLER = withApiGuard(async (guardRequest, { requestId, userId }) => {
    try {
      if (!userId) {
        const bridge = createCookieBridge()
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const context = await resolveCampaignContext({
        request: guardRequest,
        campaignId,
        requestId,
      })
      if (!context.ok) return context.response

      if (!canManageCampaign(context.membership.role, context.campaign.created_by, context.user.id)) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, context.bridge, requestId)
      }

      await deleteCampaignRecord({
        supabase: context.supabase,
        workspaceId: context.workspace.id,
        campaignId: context.campaign.id,
      })

      return ok({ deleted: true }, undefined, context.bridge, requestId)
    } catch (error) {
      const bridge = createCookieBridge()
      return asHttpError(error, '/api/campaigns/[campaignId]', userId ?? undefined, bridge, requestId)
    }
  })

  return DELETE_HANDLER(request)
}

export async function POST(request: NextRequest, ctx: { params: Promise<{ campaignId: string }> }) {
  const { campaignId: rawCampaignId } = await ctx.params
  const parsedCampaignId = CampaignIdSchema.safeParse(rawCampaignId)
  if (!parsedCampaignId.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Invalid campaign id')
  }
  const campaignId = parsedCampaignId.data

  const POST_HANDLER = withApiGuard(
    async (guardRequest, { requestId, userId, body }) => {
      try {
        if (!userId) {
          const bridge = createCookieBridge()
          return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
        }
        const action = body as z.infer<typeof CampaignPostActionSchema>

        const context = await resolveCampaignContext({
          request: guardRequest,
          campaignId,
          requestId,
        })
        if (!context.ok) return context.response

        if (!canManageCampaign(context.membership.role, context.campaign.created_by, context.user.id)) {
          return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, context.bridge, requestId)
        }

        if (action.action === 'export') {
          return fail(
            ErrorCode.VALIDATION_ERROR,
            'Use /api/campaigns/[campaignId]/export for campaign exports.',
            undefined,
            { status: 400 },
            context.bridge,
            requestId
          )
        }

        if (action.action === 'attach_leads') {
          const ownedLeads = await getOwnedLeadRows({
            supabase: context.supabase,
            userId: context.user.id,
            leadIds: action.leadIds,
          })
          if (ownedLeads.length !== action.leadIds.length) {
            return fail(
              ErrorCode.FORBIDDEN,
              'One or more leads are unavailable',
              { requested: action.leadIds.length, available: ownedLeads.length },
              { status: 403 },
              context.bridge,
              requestId
            )
          }

          await attachLeadsToCampaign({
            supabase: context.supabase,
            workspaceId: context.workspace.id,
            campaignId: context.campaign.id,
            userId: context.user.id,
            leadIds: action.leadIds,
          })

          const joins = await listCampaignLeadJoins({
            supabase: context.supabase,
            workspaceId: context.workspace.id,
            campaignId: context.campaign.id,
          })
          return ok(
            { campaignId: context.campaign.id, attached: action.leadIds.length, leadCount: joins.length },
            undefined,
            context.bridge,
            requestId
          )
        }

        await detachLeadFromCampaign({
          supabase: context.supabase,
          workspaceId: context.workspace.id,
          campaignId: context.campaign.id,
          leadId: action.leadId,
        })

        const joins = await listCampaignLeadJoins({
          supabase: context.supabase,
          workspaceId: context.workspace.id,
          campaignId: context.campaign.id,
        })
        return ok(
          { campaignId: context.campaign.id, detached: true, leadCount: joins.length },
          undefined,
          context.bridge,
          requestId
        )
      } catch (error) {
        const bridge = createCookieBridge()
        return asHttpError(error, '/api/campaigns/[campaignId]', userId ?? undefined, bridge, requestId)
      }
    },
    { bodySchema: CampaignPostActionSchema }
  )

  return POST_HANDLER(request)
}
