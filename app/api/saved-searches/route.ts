import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import {
  SavedSearchCreateSchema,
  SavedSearchPayloadSchema,
  SavedSearchRunSchema,
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearchesForUser,
  markSavedSearchRun,
  updateSavedSearch,
} from '@/lib/services/saved-searches'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  id: z.string().uuid().optional(),
})

const PatchBodySchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120).optional(),
  queryPayload: SavedSearchPayloadSchema.optional(),
})

const DeleteBodySchema = z.object({
  id: z.string().uuid(),
})

export const GET = withApiGuard(
  async (request: NextRequest, { requestId, userId }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const rows = await listSavedSearchesForUser({ supabase, userId: user.id })
      return ok({ savedSearches: rows }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/saved-searches', userId ?? undefined, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

export const POST = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const created = await createSavedSearch({
        supabase,
        userId: user.id,
        input: body as z.infer<typeof SavedSearchCreateSchema>,
      })
      return ok({ savedSearch: created }, { status: 201 }, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/saved-searches', userId ?? undefined, bridge, requestId)
    }
  },
  { bodySchema: SavedSearchCreateSchema }
)

export const PATCH = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const payload = body as z.infer<typeof PatchBodySchema>
      const hasPatch = payload.name !== undefined || payload.queryPayload !== undefined
      if (!hasPatch) {
        return fail(ErrorCode.VALIDATION_ERROR, 'At least one field must be provided.', undefined, { status: 400 }, bridge, requestId)
      }

      const updated = await updateSavedSearch({
        supabase,
        userId: user.id,
        id: payload.id,
        patch: {
          ...(payload.name !== undefined ? { name: payload.name } : {}),
          ...(payload.queryPayload !== undefined ? { queryPayload: payload.queryPayload } : {}),
        },
      })
      return ok({ savedSearch: updated }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/saved-searches', userId ?? undefined, bridge, requestId)
    }
  },
  { bodySchema: PatchBodySchema }
)

export const DELETE = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const payload = body as z.infer<typeof DeleteBodySchema>
      await deleteSavedSearch({ supabase, userId: user.id, id: payload.id })
      return ok({ deleted: true }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/saved-searches', userId ?? undefined, bridge, requestId)
    }
  },
  { bodySchema: DeleteBodySchema }
)

export const PUT = withApiGuard(
  async (request: NextRequest, { requestId, userId, body }) => {
    const bridge = createCookieBridge()
    const supabase = createRouteClient(request, bridge)
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const user = await getUserSafe(supabase)
      if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const payload = body as z.infer<typeof SavedSearchRunSchema>
      const updated = await markSavedSearchRun({
        supabase,
        userId: user.id,
        id: payload.id,
      })
      return ok({ savedSearch: updated }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/saved-searches', userId ?? undefined, bridge, requestId)
    }
  },
  { bodySchema: SavedSearchRunSchema }
)
