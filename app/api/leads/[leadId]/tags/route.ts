import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const LeadIdSchema = z.string().uuid('Invalid leadId format')

const LeadTagPostSchema = z.object({
  tagId: z.string().uuid('Invalid tag ID format'),
})

const LeadTagDeleteQuerySchema = z.object({
  tagId: z.string().uuid('Invalid tag ID format'),
})

export async function POST(request: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId: rawLeadId } = await ctx.params
  const leadIdResult = LeadIdSchema.safeParse(rawLeadId)
  if (!leadIdResult.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Invalid leadId format')
  }
  const leadId = leadIdResult.data

  const POST_GUARDED = withApiGuard(
    async (req: NextRequest, { body, userId, requestId }) => {
      const bridge = createCookieBridge()
      try {
        if (!userId) {
          return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
        }

        const { tagId } = body as z.infer<typeof LeadTagPostSchema>
        const supabase = createRouteClient(req, bridge)

        // Defense-in-depth: verify the lead belongs to this user before creating any join rows.
        const { data: lead } = await supabase.schema('api').from('leads').select('id').eq('id', leadId).eq('user_id', userId).maybeSingle()
        if (!lead) {
          return fail(ErrorCode.NOT_FOUND, 'Lead not found', undefined, { status: 404 }, bridge, requestId)
        }

        const { error } = await supabase
          .schema('api')
          .from('lead_tags')
          .insert({
            lead_id: leadId,
            tag_id: tagId,
            user_id: userId,
          })

        if (error) {
          return fail(ErrorCode.DATABASE_ERROR, 'Failed to add tag', undefined, undefined, bridge, requestId)
        }
        return ok({ success: true }, undefined, bridge, requestId)
      } catch (error) {
        return asHttpError(error, '/api/leads/[leadId]/tags', userId, bridge, requestId)
      }
    },
    { bodySchema: LeadTagPostSchema }
  )

  return POST_GUARDED(request)
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ leadId: string }> }) {
  const { leadId: rawLeadId } = await ctx.params
  const leadIdResult = LeadIdSchema.safeParse(rawLeadId)
  if (!leadIdResult.success) {
    return fail(ErrorCode.VALIDATION_ERROR, 'Invalid leadId format')
  }
  const leadId = leadIdResult.data

  const DELETE_GUARDED = withApiGuard(
    async (req: NextRequest, { query, userId, requestId }) => {
      const bridge = createCookieBridge()
      try {
        if (!userId) {
          return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
        }

        const { tagId } = query as z.infer<typeof LeadTagDeleteQuerySchema>
        const supabase = createRouteClient(req, bridge)

        const { error } = await supabase
          .from('lead_tags')
          .delete()
          .eq('user_id', userId)
          .eq('lead_id', leadId)
          .eq('tag_id', tagId)

        if (error) {
          return fail(ErrorCode.DATABASE_ERROR, 'Failed to remove tag', undefined, undefined, bridge, requestId)
        }
        return ok({ success: true }, undefined, bridge, requestId)
      } catch (error) {
        return asHttpError(error, '/api/leads/[leadId]/tags', userId, bridge, requestId)
      }
    },
    { querySchema: LeadTagDeleteQuerySchema }
  )

  return DELETE_GUARDED(request)
}
