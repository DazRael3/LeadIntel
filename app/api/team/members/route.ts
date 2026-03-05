import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import { ensurePersonalWorkspace, getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { requireTeamPlan } from '@/lib/team/gating'

export const dynamic = 'force-dynamic'

type MemberRow = {
  userId: string
  email: string | null
  displayName: string | null
  role: 'owner' | 'admin' | 'member'
  createdAt: string
}

export const GET = withApiGuard(async (request: NextRequest, { requestId, userId }) => {
  const bridge = createCookieBridge()
  const supabase = createRouteClient(request, bridge)
  try {
    if (!userId) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }
    const user = await getUserSafe(supabase)
    if (!user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
    }

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    await ensurePersonalWorkspace({ supabase, userId: user.id })
    const workspace = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!workspace) {
      return fail(ErrorCode.INTERNAL_ERROR, 'Workspace unavailable', undefined, undefined, bridge, requestId)
    }

    const membership = await getWorkspaceMembership({ supabase, workspaceId: workspace.id, userId: user.id })
    if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
      return fail(ErrorCode.FORBIDDEN, 'Access restricted', undefined, undefined, bridge, requestId)
    }

    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data: memberRows, error: membersError } = await admin
      .from('workspace_members')
      .select('user_id, role, created_at')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: true })

    if (membersError) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to load members', undefined, undefined, bridge, requestId)
    }

    const userIds = Array.from(
      new Set(
        (memberRows ?? [])
          .map((r: { user_id?: string | null }) => r.user_id ?? null)
          .filter((v: string | null): v is string => typeof v === 'string' && v.length > 0)
      )
    )

    const [usersRes, settingsRes] = await Promise.all([
      admin.from('users').select('id, email').in('id', userIds),
      admin.from('user_settings').select('user_id, display_name').in('user_id', userIds),
    ])

    const usersById = new Map<string, { email: string | null }>(
      (usersRes.data ?? []).map((r: { id?: string | null; email?: string | null }) => [String(r.id), { email: r.email ?? null }])
    )
    const namesById = new Map<string, { displayName: string | null }>(
      (settingsRes.data ?? []).map((r: { user_id?: string | null; display_name?: string | null }) => [
        String(r.user_id),
        { displayName: r.display_name ?? null },
      ])
    )

    const members: MemberRow[] = (memberRows ?? []).map((r: { user_id: string; role: string; created_at: string }) => {
      const email = usersById.get(r.user_id)?.email ?? null
      const displayName = namesById.get(r.user_id)?.displayName ?? null
      const role = r.role === 'owner' || r.role === 'admin' || r.role === 'member' ? r.role : 'member'
      return { userId: r.user_id, email, displayName, role, createdAt: r.created_at }
    })

    return ok(
      {
        workspace,
        viewer: { userId: user.id, role: membership.role },
        members,
      },
      undefined,
      bridge,
      requestId
    )
  } catch (error) {
    return asHttpError(error, '/api/team/members', userId, bridge, requestId)
  }
})

