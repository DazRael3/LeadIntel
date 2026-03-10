import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveTierFromDb, type ResolvedTier } from '@/lib/billing/resolve-tier'

export type SupportUsageSummary = {
  completePitch: number
  completeReport: number
  reservedActive: number
  cancelled24h: number
}

export type SupportContext = {
  user: { id: string; email: string | null; displayName: string | null }
  tier: ResolvedTier
  usage: SupportUsageSummary
  recentUsageEvents: Array<{ id: string; status: string; object_type: string | null; object_id: string | null; created_at: string }>
  recentReports: Array<{ id: string; status: string; report_kind: string | null; created_at: string; title: string | null }>
  recentExports: Array<{ id: string; status: string; type: string; created_at: string; ready_at: string | null; error: string | null }>
  workspace: {
    id: string
    name: string
    memberRole: string
    policies: {
      inviteAllowedDomains: string[] | null
      exportAllowedRoles: string[]
      requireHandoffApproval: boolean
    } | null
  } | null
}

function isoHoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString()
}

export async function buildSupportContext(args: { userId: string }): Promise<SupportContext | null> {
  const admin = createSupabaseAdminClient({ schema: 'api' })

  const [{ data: userRow }, { data: settingsRow }] = await Promise.all([
    admin.from('users').select('id, email').eq('id', args.userId).maybeSingle(),
    admin.from('user_settings').select('user_id, display_name').eq('user_id', args.userId).maybeSingle(),
  ])

  if (!userRow?.id) return null

  const email = typeof (userRow as { email?: unknown }).email === 'string' ? ((userRow as { email: string }).email ?? null) : null
  const displayName =
    typeof (settingsRow as { display_name?: unknown } | null)?.display_name === 'string'
      ? ((settingsRow as { display_name: string }).display_name ?? null)
      : null

  const tier = await resolveTierFromDb(admin as unknown as Parameters<typeof resolveTierFromDb>[0], args.userId, email)

  const since24h = isoHoursAgo(24)

  const [
    pitchCompleteRes,
    reportCompleteRes,
    reservedActiveRes,
    cancelled24Res,
    recentUsageRes,
    reportsRes,
    exportsRes,
    workspaceRes,
  ] = await Promise.all([
    admin.from('usage_events').select('id', { count: 'exact', head: true }).eq('user_id', args.userId).eq('status', 'complete').eq('object_type', 'pitch'),
    admin.from('usage_events').select('id', { count: 'exact', head: true }).eq('user_id', args.userId).eq('status', 'complete').eq('object_type', 'report'),
    admin
      .from('usage_events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', args.userId)
      .eq('status', 'reserved')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`),
    admin.from('usage_events').select('id', { count: 'exact', head: true }).eq('user_id', args.userId).eq('status', 'cancelled').gte('created_at', since24h),
    admin
      .from('usage_events')
      .select('id, status, object_type, object_id, created_at')
      .eq('user_id', args.userId)
      .order('created_at', { ascending: false })
      .limit(15),
    admin
      .from('user_reports')
      .select('id, status, report_kind, created_at, title')
      .eq('user_id', args.userId)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('export_jobs')
      .select('id, status, type, created_at, ready_at, error')
      .eq('created_by', args.userId)
      .order('created_at', { ascending: false })
      .limit(10),
    admin
      .from('workspace_members')
      .select('workspace_id, role, workspaces!inner(id, name)')
      .eq('user_id', args.userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const wsId = (workspaceRes.data as unknown as { workspace_id?: unknown } | null)?.workspace_id
  const wsRole = (workspaceRes.data as unknown as { role?: unknown } | null)?.role
  const wsObj = (workspaceRes.data as unknown as { workspaces?: { id?: unknown; name?: unknown } } | null)?.workspaces
  const workspaceId = typeof wsId === 'string' ? wsId : null
  const workspaceName = wsObj && typeof wsObj.name === 'string' ? wsObj.name : null
  const memberRole = typeof wsRole === 'string' ? wsRole : null

  const policies =
    workspaceId
      ? await (async () => {
          const { data: row } = await admin.from('workspace_policies').select('policy').eq('workspace_id', workspaceId).maybeSingle()
          const p = (row as unknown as { policy?: unknown } | null)?.policy
          if (!p || typeof p !== 'object') return null
          const inviteAllowedDomains = (p as any)?.invite?.allowedDomains
          const exportAllowedRoles = (p as any)?.exports?.allowedRoles
          const requireHandoffApproval = (p as any)?.handoffs?.requireApproval
          return {
            inviteAllowedDomains: Array.isArray(inviteAllowedDomains) ? (inviteAllowedDomains as unknown[]).filter((x): x is string => typeof x === 'string') : null,
            exportAllowedRoles: Array.isArray(exportAllowedRoles) ? (exportAllowedRoles as unknown[]).filter((x): x is string => typeof x === 'string') : [],
            requireHandoffApproval: typeof requireHandoffApproval === 'boolean' ? requireHandoffApproval : false,
          }
        })()
      : null

  return {
    user: { id: args.userId, email, displayName },
    tier,
    usage: {
      completePitch: typeof pitchCompleteRes.count === 'number' ? pitchCompleteRes.count : 0,
      completeReport: typeof reportCompleteRes.count === 'number' ? reportCompleteRes.count : 0,
      reservedActive: typeof reservedActiveRes.count === 'number' ? reservedActiveRes.count : 0,
      cancelled24h: typeof cancelled24Res.count === 'number' ? cancelled24Res.count : 0,
    },
    recentUsageEvents: (recentUsageRes.data ?? []) as Array<{
      id: string
      status: string
      object_type: string | null
      object_id: string | null
      created_at: string
    }>,
    recentReports: (reportsRes.data ?? []) as Array<{ id: string; status: string; report_kind: string | null; created_at: string; title: string | null }>,
    recentExports: (exportsRes.data ?? []) as Array<{
      id: string
      status: string
      type: string
      created_at: string
      ready_at: string | null
      error: string | null
    }>,
    workspace:
      workspaceId && workspaceName && memberRole
        ? {
            id: workspaceId,
            name: workspaceName,
            memberRole,
            policies,
          }
        : null,
  }
}

export async function lookupUserIdByEmail(email: string): Promise<string | null> {
  const admin = createSupabaseAdminClient({ schema: 'api' })
  const e = email.trim().toLowerCase()
  if (!e) return null
  const { data } = await admin.from('users').select('id').eq('email', e).maybeSingle()
  const id = (data as { id?: unknown } | null)?.id
  return typeof id === 'string' && id.length > 0 ? id : null
}

