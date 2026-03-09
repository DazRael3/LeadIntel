import { NextRequest } from 'next/server'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, createCookieBridge, asHttpError } from '@/lib/api/http'
import { createRouteClient } from '@/lib/supabase/route'
import { getUserSafe } from '@/lib/supabase/safe-auth'

export const dynamic = 'force-dynamic'

type LeadRow = { id: string; created_at: string | null; company_name: string | null; company_domain: string | null }
type PitchRow = { id: string; created_at: string | null }
type ReportRow = { id: string; created_at: string | null; report_kind: string | null; status: string | null; title: string | null }

type ActivityKind = 'target_added' | 'pitch_generated' | 'report_saved' | 'brief_saved'
export type RecentActivityItem = {
  id: string
  kind: ActivityKind
  createdAt: string
  label: string
  href: string | null
}

function isIso(ts: unknown): ts is string {
  if (typeof ts !== 'string') return false
  return Number.isFinite(Date.parse(ts))
}

export const GET = withApiGuard(async (request: NextRequest, { requestId }) => {
  const bridge = createCookieBridge()
  try {
    const supabase = createRouteClient(request, bridge)
    const user = await getUserSafe(supabase)
    if (!user) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

    const [leadsRes, pitchesRes, reportsRes] = await Promise.all([
      supabase.from('leads').select('id, created_at, company_name, company_domain').order('created_at', { ascending: false }).limit(8),
      supabase.from('pitches').select('id, created_at').order('created_at', { ascending: false }).limit(8),
      supabase
        .from('user_reports')
        .select('id, created_at, report_kind, status, title')
        .order('created_at', { ascending: false })
        .limit(12),
    ])

    const items: RecentActivityItem[] = []

    for (const r of (leadsRes.data ?? []) as unknown as LeadRow[]) {
      if (!isIso(r.created_at)) continue
      const labelBase = (r.company_domain ?? '').trim() || (r.company_name ?? '').trim() || 'Unknown account'
      items.push({
        id: r.id,
        kind: 'target_added',
        createdAt: r.created_at,
        label: `Tracked: ${labelBase}`,
        href: null,
      })
    }

    for (const p of (pitchesRes.data ?? []) as unknown as PitchRow[]) {
      if (!isIso(p.created_at)) continue
      items.push({
        id: p.id,
        kind: 'pitch_generated',
        createdAt: p.created_at,
        label: 'Pitch preview generated',
        href: '/pitch-history',
      })
    }

    for (const rep of (reportsRes.data ?? []) as unknown as ReportRow[]) {
      if (!isIso(rep.created_at)) continue
      const kind = (rep.report_kind ?? '').trim()
      if (kind === 'account_brief') {
        items.push({
          id: rep.id,
          kind: 'brief_saved',
          createdAt: rep.created_at,
          label: rep.status === 'complete' ? 'Account brief saved' : 'Account brief generated',
          href: '/reports',
        })
      } else if (kind === 'competitive') {
        items.push({
          id: rep.id,
          kind: 'report_saved',
          createdAt: rep.created_at,
          label: rep.status === 'complete' ? 'Competitive report saved' : 'Competitive report generated',
          href: '/reports',
        })
      }
    }

    const sorted = items
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12)

    return ok({ items: sorted }, undefined, bridge, requestId)
  } catch (error) {
    return asHttpError(error, '/api/activity/recent', undefined, bridge, requestId)
  }
})

