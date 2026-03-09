import { NextRequest } from 'next/server'
import { getRequestId } from '@/lib/api/with-request-id'
import { platformFail, platformOk, PlatformErrorCode } from '@/lib/platform-api/responses'
import { withPlatformAuth, logPlatformRequest } from '@/lib/platform-api/middleware'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serializeWorkspace } from '@/lib/platform-api/serializers/workspace'
import { ErrorCode } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  const started = Date.now()
  const path = new URL(request.url).pathname

  const authed = await withPlatformAuth({ request, requestId, requiredScopes: ['workspace.read'] })
  if (!authed.ok) {
    await logPlatformRequest({
      workspaceId: 'unknown',
      apiKeyId: 'unknown',
      method: 'GET',
      route: path,
      status: 401,
      errorCode: PlatformErrorCode.PLATFORM_KEY_INVALID,
      requestId,
      latencyMs: Date.now() - started,
    }).catch(() => undefined)
    return authed.response
  }

  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data } = await admin
      .from('workspaces')
      .select('id, name, created_at, client_label, reference_tags')
      .eq('id', authed.ctx.workspaceId)
      .maybeSingle()

    if (!data) {
      const res = platformFail(ErrorCode.NOT_FOUND, 'Workspace not found', undefined, { status: 404 }, requestId)
      await logPlatformRequest({
        workspaceId: authed.ctx.workspaceId,
        apiKeyId: authed.ctx.apiKeyId,
        method: 'GET',
        route: path,
        status: 404,
        errorCode: ErrorCode.NOT_FOUND,
        requestId,
        latencyMs: Date.now() - started,
      }).catch(() => undefined)
      return res
    }

    const row = data as unknown as {
      id: string
      name: string
      created_at: string | null
      client_label: string | null
      reference_tags: unknown
    }
    const ws = serializeWorkspace({ workspace: row })
    const res = platformOk({ workspace: ws }, undefined, requestId)
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

