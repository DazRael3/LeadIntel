import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validateQuery, validationError } from '@/lib/api/validate'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const LeadTagPostSchema = z.object({
  tagId: z.string().uuid('Invalid tag ID format'),
})

const LeadTagDeleteQuerySchema = z.object({
  tagId: z.string().uuid('Invalid tag ID format'),
})

export async function POST(request: NextRequest, { params }: { params: { leadId: string } }) {
  const bridge = createCookieBridge()
  
  try {
    // Validate path parameter
    const leadId = params.leadId
    if (!leadId || !z.string().uuid().safeParse(leadId).success) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid leadId format', undefined, undefined, bridge)
    }

    // Validate request body
    let body
    try {
      body = await validateBody(request, LeadTagPostSchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const { tagId } = body

    const { error } = await supabase
      .from('lead_tags')
      .insert({
        lead_id: leadId,
        tag_id: tagId,
        user_id: user.id,
      })

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to add tag', undefined, undefined, bridge)
    }
    return ok({ success: true }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/leads/[leadId]/tags', undefined, bridge)
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { leadId: string } }) {
  const bridge = createCookieBridge()
  
  try {
    // Validate path parameter
    const leadId = params.leadId
    if (!leadId || !z.string().uuid().safeParse(leadId).success) {
      return fail(ErrorCode.VALIDATION_ERROR, 'Invalid leadId format', undefined, undefined, bridge)
    }

    // Validate query parameters
    let query
    try {
      query = await validateQuery(request, LeadTagDeleteQuerySchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const { tagId } = query

    const { error } = await supabase
      .from('lead_tags')
      .delete()
      .eq('user_id', user.id)
      .eq('lead_id', leadId)
      .eq('tag_id', tagId)

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to remove tag', undefined, undefined, bridge)
    }
    return ok({ success: true }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/leads/[leadId]/tags', undefined, bridge)
  }
}
