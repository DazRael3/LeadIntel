import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { requireCapability } from '@/lib/billing/require-capability'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { isSchemaError } from '@/lib/supabase/schema'

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

    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) {
      return fail(
        ErrorCode.CONFLICT,
        'Workspace unavailable',
        { reason: 'WORKSPACE_UNAVAILABLE' },
        { status: 409 },
        bridge,
        requestId
      )
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership) return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)

    const { data: jobs, error } = await supabase
      .schema('api')
      .from('export_jobs')
      .select('id, type, status, created_at, ready_at, error, file_path')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(25)

    if (error) {
      if (isSchemaError(error)) {
        return fail(
          ErrorCode.SCHEMA_MIGRATION_REQUIRED,
          'Exports schema unavailable',
          { reason: 'SCHEMA_NOT_EXPOSED' },
          { status: 424 },
          bridge,
          requestId
        )
      }
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to load exports', undefined, undefined, bridge, requestId)
    }

    return ok({ workspace, jobs: jobs ?? [] }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/exports/jobs', userId, bridge, requestId)
  }
})

