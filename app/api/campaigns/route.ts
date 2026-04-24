import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import {
  CampaignCreateSchema,
  canCreateCampaign,
  createCampaignRecord,
  getOwnedLeadRows,
  listCampaignLeadJoins,
  listCampaignsForWorkspace,
  attachLeadsToCampaign,
} from '@/lib/services/campaigns'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  includeLeads: z
    .enum(['0', '1', 'true', 'false'])
    .optional()
    .transform((value) => value === '1' || value === 'true'),
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

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return ok({ workspace: null, campaigns: [] }, undefined, bridge, requestId)
      }
      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const includeLeads = (query as z.infer<typeof QuerySchema> | undefined)?.includeLeads ?? false
      const campaigns = await listCampaignsForWorkspace({ supabase, workspaceId: workspace.id })

      if (!includeLeads) {
        return ok({ workspace, campaigns }, undefined, bridge, requestId)
      }

      const withLeads = await Promise.all(
        campaigns.map(async (campaign) => {
          const joins = await listCampaignLeadJoins({
            supabase,
            workspaceId: workspace.id,
            campaignId: campaign.id,
          })
          const leadIds = joins.map((join) => join.lead_id)
          const leadRows = await getOwnedLeadRows({ supabase, userId: user.id, leadIds })
          return {
            ...campaign,
            leadCount: joins.length,
            leads: leadRows,
          }
        })
      )

      return ok({ workspace, campaigns: withLeads }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/campaigns', userId ?? undefined, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

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

      const parsed = CampaignCreateSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, bridge, requestId)
      }

      await ensurePersonalWorkspace({ supabase, userId: user.id })
      const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
      if (!workspace) {
        return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
      }
      const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
      if (!membership || !canCreateCampaign(membership.role)) {
        return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
      }

      const campaign = await createCampaignRecord({
        supabase,
        workspaceId: workspace.id,
        userId: user.id,
        input: parsed.data,
      })

      const leadIds = parsed.data.leadIds ?? []
      let attached = 0
      if (leadIds.length > 0) {
        const ownedLeads = await getOwnedLeadRows({ supabase, userId: user.id, leadIds })
        if (ownedLeads.length !== leadIds.length) {
          return fail(
            ErrorCode.FORBIDDEN,
            'One or more leads are unavailable',
            { requested: leadIds.length, available: ownedLeads.length },
            { status: 403 },
            bridge,
            requestId
          )
        }
        await attachLeadsToCampaign({
          supabase,
          workspaceId: workspace.id,
          campaignId: campaign.id,
          userId: user.id,
          leadIds,
        })
        attached = leadIds.length
      }

      return ok({ workspace, campaign, attachedLeads: attached }, { status: 201 }, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/campaigns', userId ?? undefined, bridge, requestId)
    }
  },
  { bodySchema: CampaignCreateSchema }
)
