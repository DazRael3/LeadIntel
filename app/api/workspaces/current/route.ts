import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'

export const dynamic = 'force-dynamic'

function looksLikeSchemaOrApiExposureIssue(error: unknown): boolean {
  const err = error as { code?: unknown; message?: unknown }
  const code = typeof err?.code === 'string' ? err.code : ''
  const message = typeof err?.message === 'string' ? err.message : ''
  if (code === 'PGRST106') return true // invalid schema / not exposed
  const m = message.toLowerCase()
  return (
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('undefined_table') ||
    m.includes('does not exist') ||
    m.includes('invalid schema')
  )
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    // Prefer current workspace when available; otherwise attempt to bootstrap a personal workspace.
    let workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    let bootstrapUnavailable = false
    if (!workspace) {
      try {
        await ensurePersonalWorkspace({ supabase, userId: user.id })
      } catch (e) {
        if (looksLikeSchemaOrApiExposureIssue(e)) {
          return fail(
            ErrorCode.SCHEMA_MIGRATION_REQUIRED,
            'Workspace backend not configured',
            {
              hint:
                'Ensure Supabase exposes the "api" schema to PostgREST and that workspace migrations have been applied.',
              supabaseHint: 'Supabase → Settings → API → Exposed schemas: include "api", then save.',
            },
            { status: 424 },
            bridge,
            requestId
          )
        }
        // Treat bootstrap failure as recoverable for valid users: return a typed, intentional state
        // so the dashboard can render calmly instead of surfacing a generic 503.
        bootstrapUnavailable = true
      }
      workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    }
    if (!workspace) {
      return ok(
        {
          workspace: null,
          role: null,
          state: bootstrapUnavailable ? 'bootstrap_unavailable' : 'missing',
          hint: bootstrapUnavailable
            ? 'Workspace setup is temporarily unavailable. Please refresh and try again. If this persists, contact support.'
            : 'No workspace yet. Continue onboarding or refresh to retry workspace setup.',
        },
        undefined,
        bridge,
        requestId
      )
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    return ok({ workspace, role: membership?.role ?? null, state: 'ready' }, undefined, bridge, requestId)
  } catch (e) {
    return asHttpError(e, '/api/workspaces/current', userId, bridge, requestId)
  }
})

