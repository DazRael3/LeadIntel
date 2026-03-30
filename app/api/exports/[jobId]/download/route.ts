import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { getExportDownload } from '@/lib/exports/storage'
import { logAudit } from '@/lib/audit/log'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const gate = await requireCapability({ userId: user.id, sessionEmail: user.email ?? null, supabase, capability: 'governance_exports' })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const parts = new URL(request.url).pathname.split('/')
    const jobId = parts[parts.length - 2] || ''
    if (!jobId) return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', { jobId: 'Missing job id' }, undefined, bridge, requestId)

    const { data: job } = await supabase
      .schema('api')
      .from('export_jobs')
      .select('id, workspace_id, status, file_path, type')
      .eq('id', jobId)
      .eq('workspace_id', workspace.id)
      .maybeSingle()

    if (!job) return fail(ErrorCode.NOT_FOUND, 'Not found', undefined, { status: 404 }, bridge, requestId)
    if (job.status !== 'ready' || !job.file_path) {
      return fail(ErrorCode.CONFLICT, 'Export not ready', undefined, { status: 409 }, bridge, requestId)
    }

    const dl = await getExportDownload({ filePath: job.file_path })

    await logAudit({
      supabase,
      workspaceId: workspace.id,
      actorUserId: user.id,
      action: 'export.downloaded',
      targetType: 'export_job',
      targetId: jobId,
      meta: { type: job.type },
      request,
    })

    if (dl.mode === 'signedUrl') {
      return ok({ url: dl.url }, undefined, bridge, requestId)
    }

    return new NextResponse(dl.content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${job.type}-${jobId}.csv"`,
        'X-Request-ID': requestId,
      },
    })
  } catch (error) {
    return asHttpError(error, '/api/exports/[jobId]/download', userId, bridge, requestId)
  }
})

