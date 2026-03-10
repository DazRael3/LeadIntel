import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestId } from '@/lib/api/with-request-id'
import { platformFail, platformOk } from '@/lib/platform-api/responses'
import { withPlatformAuth, logPlatformRequest } from '@/lib/platform-api/middleware'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { decodeCursor, encodeCursor } from '@/lib/platform-api/pagination'
import { serializeAccountProgramRow, type ProgramAccountRow } from '@/lib/platform-api/serializers/account'
import type { ListResponse } from '@/lib/platform-api/objects'
import { ErrorCode } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
  state: z.enum(['strategic', 'named', 'expansion_watch', 'monitor', 'standard']).optional(),
})

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  const started = Date.now()
  const path = new URL(request.url).pathname

  const authed = await withPlatformAuth({ request, requestId, requiredScopes: ['accounts.read'] })
  if (!authed.ok) return authed.response

  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) return platformFail(ErrorCode.VALIDATION_ERROR, 'Invalid query', parsed.error.flatten(), { status: 400 }, requestId)

  const cursor = decodeCursor(parsed.data.cursor ?? null)

  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    let q = admin
      .from('account_program_accounts')
      .select('id, workspace_id, lead_id, account_domain, account_name, program_state, note, created_at, updated_at')
      .eq('workspace_id', authed.ctx.workspaceId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(parsed.data.limit + 1)

    if (parsed.data.state) q = q.eq('program_state', parsed.data.state)

    if (cursor) {
      // (updated_at, id) < (cursor.t, cursor.id) in descending order
      q = q.or(`updated_at.lt.${cursor.t},and(updated_at.eq.${cursor.t},id.lt.${cursor.id})`)
    }

    const { data } = await q
    const rows = (data ?? []) as unknown as ProgramAccountRow[]
    const page = rows.slice(0, parsed.data.limit)
    const next = rows.length > parsed.data.limit ? rows[parsed.data.limit] ?? null : null

    const items = page.map((r) => serializeAccountProgramRow(r))
    const response: ListResponse<typeof items[number]> = {
      items,
      pagination: { nextCursor: next ? encodeCursor({ t: next.updated_at, id: next.id }) : null },
    }

    const res = platformOk(response, undefined, requestId)
    await logPlatformRequest({
      workspaceId: authed.ctx.workspaceId,
      apiKeyId: authed.ctx.apiKeyId,
      method: 'GET',
      route: path,
      status: 200,
      errorCode: null,
      requestId,
      latencyMs: Date.now() - started,
    }).catch(() => undefined)
    return res
  } catch {
    const res = platformFail(ErrorCode.INTERNAL_ERROR, 'Request failed', undefined, { status: 500 }, requestId)
    await logPlatformRequest({
      workspaceId: authed.ctx.workspaceId,
      apiKeyId: authed.ctx.apiKeyId,
      method: 'GET',
      route: path,
      status: 500,
      errorCode: ErrorCode.INTERNAL_ERROR,
      requestId,
      latencyMs: Date.now() - started,
    }).catch(() => undefined)
    return res
  }
}

