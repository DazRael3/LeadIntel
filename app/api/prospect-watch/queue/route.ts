import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { requireTeamPlan } from '@/lib/team/gating'
import { getCurrentWorkspace, getWorkspaceMembership } from '@/lib/team/workspace'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  kind: z.enum(['prospects', 'content']),
})

function isPrivileged(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin' || role === 'manager'
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const supabase = createRouteClient(request, bridge)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, { status: 401 }, bridge, requestId)

    const gate = await requireTeamPlan({ userId: user.id, sessionEmail: user.email ?? null, supabase })
    if (!gate.ok) return fail(ErrorCode.FORBIDDEN, 'Team plan required', undefined, { status: 403 }, bridge, requestId)

    const url = new URL(request.url)
    const parsed = QuerySchema.safeParse({ kind: url.searchParams.get('kind') })
    if (!parsed.success) return fail(ErrorCode.VALIDATION_ERROR, 'Invalid query', parsed.error.flatten(), { status: 400 }, bridge, requestId)

    const ws = await getCurrentWorkspace({ supabase, userId: user.id })
    if (!ws) return ok({ workspaceId: null, role: null, items: [], configured: false, reason: 'workspace_missing' }, undefined, bridge, requestId)

    const membership = await getWorkspaceMembership({ supabase, workspaceId: ws.id, userId: user.id })
    const role = membership?.role ?? null
    if (!membership || !isPrivileged(role)) {
      return fail(ErrorCode.FORBIDDEN, 'Admin access required', { role }, { status: 403 }, bridge, requestId)
    }

    const client = supabase.schema('api')
    if (parsed.data.kind === 'prospects') {
      const { data: prospects } = await client
        .from('prospect_watch_prospects')
        .select('id, overall_score, status, updated_at, target_id, signal_id')
        .eq('workspace_id', ws.id)
        .order('overall_score', { ascending: false })
        .limit(60)

      const ids = (prospects ?? []).map((p) => (p as any).id).filter(Boolean)
      const targetIds = (prospects ?? []).map((p) => (p as any).target_id).filter(Boolean)
      const signalIds = (prospects ?? []).map((p) => (p as any).signal_id).filter(Boolean)

      const [targetsRes, signalsRes, scoresRes, draftsRes] = await Promise.all([
        client.from('prospect_watch_targets').select('id, company_name, company_domain').in('id', targetIds).limit(200),
        client.from('prospect_watch_signals').select('id, title, source_url, signal_type').in('id', signalIds).limit(200),
        client.from('prospect_watch_scores').select('signal_id, target_id, reasons').in('signal_id', signalIds).limit(400),
        client.from('prospect_watch_outreach_drafts').select('id, prospect_id, channel, status, subject, body, to_email').in('prospect_id', ids).limit(400),
      ])

      const targets = new Map<string, any>()
      for (const t of (targetsRes.data ?? []) as any[]) targets.set(t.id, t)
      const signals = new Map<string, any>()
      for (const s of (signalsRes.data ?? []) as any[]) signals.set(s.id, s)
      const reasonsByPair = new Map<string, string[]>()
      for (const r of (scoresRes.data ?? []) as any[]) {
        const key = `${r.target_id}:${r.signal_id}`
        const arr = Array.isArray(r.reasons) ? (r.reasons as string[]) : []
        reasonsByPair.set(key, arr)
      }
      const draftsByProspect = new Map<string, any[]>()
      for (const d of (draftsRes.data ?? []) as any[]) {
        const pid = d.prospect_id as string
        const arr = draftsByProspect.get(pid) ?? []
        arr.push(d)
        draftsByProspect.set(pid, arr)
      }

      const items = (prospects ?? []).map((p: any) => {
        const t = targets.get(p.target_id) ?? {}
        const s = signals.get(p.signal_id) ?? {}
        const reasons = reasonsByPair.get(`${p.target_id}:${p.signal_id}`) ?? []
        return {
          id: p.id,
          overall_score: p.overall_score ?? 0,
          status: p.status ?? 'new',
          updated_at: p.updated_at ?? null,
          company_name: t.company_name ?? 'Unknown',
          company_domain: t.company_domain ?? null,
          signal_title: s.title ?? 'Signal',
          signal_url: s.source_url ?? '#',
          signal_type: s.signal_type ?? 'other',
          reasons,
          drafts: (draftsByProspect.get(p.id) ?? []).map((d) => ({
            id: d.id,
            channel: d.channel,
            status: d.status,
            subject: d.subject ?? null,
            body: d.body ?? '',
            to_email: d.to_email ?? null,
          })),
        }
      })

      return ok({ workspaceId: ws.id, role, items }, undefined, bridge, requestId)
    }

    // content
    const { data: drafts } = await client
      .from('prospect_watch_content_drafts')
      .select('id, status, angle, body, cta, created_at, prospect_id')
      .eq('workspace_id', ws.id)
      .order('created_at', { ascending: false })
      .limit(60)

    const prospectIds = (drafts ?? []).map((d) => (d as any).prospect_id).filter(Boolean)
    const { data: prospects } = await client
      .from('prospect_watch_prospects')
      .select('id, overall_score, target_id, signal_id')
      .in('id', prospectIds)
      .limit(120)
    const targetIds = (prospects ?? []).map((p) => (p as any).target_id).filter(Boolean)
    const signalIds = (prospects ?? []).map((p) => (p as any).signal_id).filter(Boolean)
    const [targetsRes, signalsRes] = await Promise.all([
      client.from('prospect_watch_targets').select('id, company_name').in('id', targetIds).limit(200),
      client.from('prospect_watch_signals').select('id, title, source_url').in('id', signalIds).limit(200),
    ])
    const targets = new Map<string, any>()
    for (const t of (targetsRes.data ?? []) as any[]) targets.set(t.id, t)
    const signals = new Map<string, any>()
    for (const s of (signalsRes.data ?? []) as any[]) signals.set(s.id, s)
    const prospectMap = new Map<string, any>()
    for (const p of (prospects ?? []) as any[]) prospectMap.set(p.id, p)

    const items = (drafts ?? []).map((d: any) => {
      const p = prospectMap.get(d.prospect_id) ?? {}
      const t = targets.get(p.target_id) ?? {}
      const s = signals.get(p.signal_id) ?? {}
      return {
        id: d.id,
        status: d.status,
        angle: d.angle,
        body: d.body,
        cta: d.cta ?? null,
        created_at: d.created_at,
        company_name: t.company_name ?? 'Unknown',
        signal_title: s.title ?? 'Signal',
        signal_url: s.source_url ?? '#',
        overall_score: p.overall_score ?? 0,
      }
    })

    return ok({ workspaceId: ws.id, role, items }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/prospect-watch/queue', undefined, bridge, requestId)
  }
})

