import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { TagNameSchema } from '@/lib/api/schemas'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

const TagIdQuerySchema = z.object({
  id: z.string().uuid('Invalid tag ID format'),
})

export async function GET(request: NextRequest) {
  return GET_GUARDED(request)
}

const GET_GUARDED = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const { data, error } = await supabase
      .from('tags')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to fetch tags', undefined, undefined, bridge, requestId)
    }
    return ok({ items: data }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/tags', undefined, bridge, requestId)
  }
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const nameRaw = (body as z.infer<typeof TagNameSchema>).name.trim()

    // Upsert style: dedupe by case-insensitive name via generated column name_ci
    const { data, error } = await supabase
      .from('tags')
      .upsert({
        user_id: user.id,
        name: nameRaw,
      }, {
        onConflict: 'user_id,name_ci',
        ignoreDuplicates: false,
      })
      .select('id, name, name_ci, created_at')
      .single()

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to create tag', undefined, undefined, bridge, requestId)
    }
    return ok({ item: data }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/tags', undefined, bridge, requestId)
    }
  },
  { bodySchema: TagNameSchema }
)

export const DELETE = withApiGuard(
  async (request: NextRequest, { query, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const supabase = createRouteClient(request, bridge)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const id = (query as z.infer<typeof TagIdQuerySchema>).id

    const { error: delError } = await supabase
      .from('tags')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id)

    if (delError) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to delete tag', undefined, undefined, bridge, requestId)
    }
      return ok({ success: true }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/tags', undefined, bridge, requestId)
    }
  },
  { querySchema: TagIdQuerySchema }
)
