import type { SupabaseClient } from '@supabase/supabase-js'
import type { PremiumGenerationCapabilities } from '@/lib/billing/premium-generations'

export type PremiumActivityStatus = 'preview_locked' | 'full_access' | 'saved'
export type PremiumActivityType = 'pitch' | 'report'

export type PremiumActivityItem = {
  assetType: PremiumActivityType
  objectId: string
  title: string
  companyName: string | null
  companyDomain: string | null
  createdAt: string
  status: PremiumActivityStatus
  statusLabel: string
  sourceSurface: string | null
  primaryAction: { label: string; href: string }
  upgradeAction?: { label: string; href: string }
}

type PitchRow = { id: string; created_at: string; lead_id: string }
type LeadRow = { id: string; company_name: string | null; company_domain: string | null; company_url: string | null }
type ReportRow = { id: string; created_at: string; company_name: string; company_domain: string | null; title: string; status: string; report_kind: string }

function buildPitchHref(args: { companyName: string | null; companyDomain: string | null; companyUrl: string | null }): string {
  const raw =
    (args.companyUrl ?? '').trim() ||
    (args.companyDomain ?? '').trim() ||
    (args.companyName ?? '').trim()

  if (!raw) return '/pitch'

  const qs = new URLSearchParams()
  qs.set('url', raw)
  if (args.companyName && args.companyName.trim().length > 0) qs.set('name', args.companyName.trim())
  return `/pitch?${qs.toString()}`
}

export async function getRecentPremiumActivity(args: {
  supabase: SupabaseClient
  userId: string
  capabilities: PremiumGenerationCapabilities
  limit?: number
}): Promise<PremiumActivityItem[]> {
  const limit = Math.max(1, Math.min(args.limit ?? 12, 30))

  const [pitchesRes, reportsRes] = await Promise.all([
    args.supabase
      .from('pitches')
      .select('id, created_at, lead_id')
      .eq('user_id', args.userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    args.supabase
      .from('user_reports')
      .select('id, created_at, company_name, company_domain, title, status, report_kind')
      .eq('user_id', args.userId)
      .eq('report_kind', 'competitive')
      .eq('status', 'complete')
      .order('created_at', { ascending: false })
      .limit(limit),
  ])

  const pitches = (pitchesRes.data ?? []) as PitchRow[]
  const reports = (reportsRes.data ?? []) as ReportRow[]

  const leadIds = Array.from(new Set(pitches.map((p) => p.lead_id).filter((id) => typeof id === 'string' && id.length > 0)))
  const leadsById = new Map<string, LeadRow>()

  if (leadIds.length > 0) {
    const { data: leadRows } = await args.supabase
      .from('leads')
      .select('id, company_name, company_domain, company_url')
      .in('id', leadIds)

    for (const row of (leadRows ?? []) as LeadRow[]) {
      leadsById.set(row.id, row)
    }
  }

  const pitchItems: PremiumActivityItem[] = pitches.map((p) => {
    const lead = leadsById.get(p.lead_id) ?? null
    const locked = args.capabilities.blurPremiumSections
    const status: PremiumActivityStatus = locked ? 'preview_locked' : 'full_access'
    const statusLabel = locked ? 'Preview locked' : 'Full access'

    const companyName = lead?.company_name ?? null
    const companyDomain = lead?.company_domain ?? null

    return {
      assetType: 'pitch',
      objectId: p.id,
      title: companyName ?? companyDomain ?? 'Pitch',
      companyName,
      companyDomain,
      createdAt: p.created_at,
      status,
      statusLabel,
      sourceSurface: 'pitch',
      primaryAction: { label: 'View pitch page', href: buildPitchHref({ companyName, companyDomain, companyUrl: lead?.company_url ?? null }) },
      upgradeAction: locked ? { label: 'Upgrade', href: '/pricing?target=closer' } : undefined,
    }
  })

  const reportItems: PremiumActivityItem[] = reports.map((r) => {
    const locked = args.capabilities.blurPremiumSections
    return {
      assetType: 'report',
      objectId: r.id,
      title: r.company_name || r.title || 'Report',
      companyName: r.company_name ?? null,
      companyDomain: r.company_domain ?? null,
      createdAt: r.created_at,
      status: 'saved',
      statusLabel: locked ? 'Report saved (preview locked)' : 'Report saved',
      sourceSurface: 'competitive_report',
      primaryAction: { label: 'Open report', href: `/competitive-report?id=${encodeURIComponent(r.id)}` },
      upgradeAction: locked ? { label: 'Upgrade', href: '/pricing?target=closer' } : undefined,
    }
  })

  const merged = [...pitchItems, ...reportItems]
    .filter((x) => typeof x.createdAt === 'string' && x.createdAt.length > 0)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit)

  return merged
}

