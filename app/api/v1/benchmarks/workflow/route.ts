import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getRequestId } from '@/lib/api/with-request-id'
import { platformFail, platformOk } from '@/lib/platform-api/responses'
import { withPlatformAuth, logPlatformRequest } from '@/lib/platform-api/middleware'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getWorkflowBenchmarks } from '@/lib/services/workflow-benchmarks'
import { getWorkspacePolicies } from '@/lib/services/workspace-policies'
import { ErrorCode } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  windowDays: z.coerce.number().int().min(7).max(90).optional().default(30),
})

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  const started = Date.now()
  const path = new URL(request.url).pathname

  const authed = await withPlatformAuth({ request, requestId, requiredScopes: ['benchmarks.read'] })
  if (!authed.ok) return authed.response

  const parsed = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()))
  if (!parsed.success) return platformFail(ErrorCode.VALIDATION_ERROR, 'Invalid query', parsed.error.flatten(), { status: 400 }, requestId)

  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { policies } = await getWorkspacePolicies({ supabase: admin, workspaceId: authed.ctx.workspaceId })
    if (!policies.benchmarks.benchmarksEnabled) {
      return platformFail(ErrorCode.FORBIDDEN, 'Benchmarks disabled for this workspace', undefined, { status: 403 }, requestId)
    }

    const res = await getWorkflowBenchmarks({
      supabase: admin,
      workspaceId: authed.ctx.workspaceId,
      windowDays: parsed.data.windowDays,
      enableCrossWorkspace: policies.benchmarks.crossWorkspaceInsightsEnabled,
      enablePriorPeriod: policies.benchmarks.priorPeriodEnabled,
    })

    const out = {
      object: 'benchmark_summary' as const,
      workspace_id: authed.ctx.workspaceId,
      window_days: parsed.data.windowDays,
      metrics: res.metrics,
    }

    const http = platformOk(out, undefined, requestId)
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
    return http
  } catch {
    const http = platformFail(ErrorCode.INTERNAL_ERROR, 'Request failed', undefined, { status: 500 }, requestId)
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
    return http
  }
}

