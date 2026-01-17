import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validateQuery, validationError } from '@/lib/api/validate'
import { TagNameSchema } from '@/lib/api/schemas'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const TagIdQuerySchema = z.object({
  id: z.string().uuid('Invalid tag ID format'),
})

export async function GET(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const { data, error } = await supabase
      .from('tags')
      .select('id, name, created_at')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to fetch tags', undefined, undefined, bridge)
    }
    return ok({ items: data }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/tags', undefined, bridge)
  }
}

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    // Validate request body
    let body
    try {
      body = await validateBody(request, TagNameSchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const nameRaw = body.name.trim()

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
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to create tag', undefined, undefined, bridge)
    }
    return ok({ item: data }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/tags', undefined, bridge)
  }
}

export async function DELETE(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    // Validate query parameters
    let query
    try {
      query = await validateQuery(request, TagIdQuerySchema)
    } catch (error) {
      return validationError(error, bridge)
    }

    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const id = query.id

    const { error: delError } = await supabase
      .from('tags')
      .delete()
      .eq('user_id', user.id)
      .eq('id', id)

    if (delError) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to delete tag', undefined, undefined, bridge)
    }
    return ok({ success: true }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/tags', undefined, bridge)
  }
}
