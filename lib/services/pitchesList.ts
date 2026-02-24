import type { SupabaseClient } from '@supabase/supabase-js'
import type { LatestPitch } from '@/lib/services/pitches'
import { buildLatestPitchDeepLink } from '@/lib/services/pitchesLatest'

export interface SavedReportSummary {
  id: string
  companyName: string
  createdAt: Date
  previewBullets: string[]
  deepLinkHref: string
}

function extractPreviewBullets(content: string, max: number): string[] {
  const lines = content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 12)

  const bullets: string[] = []
  for (const line of lines) {
    const cleaned = line.replace(/^[-*•]\s+/, '').trim()
    if (!cleaned) continue
    bullets.push(cleaned.length > 140 ? `${cleaned.slice(0, 140)}…` : cleaned)
    if (bullets.length >= max) break
  }
  return bullets
}

function toLatestPitchForDeepLink(row: {
  id: string
  lead_id: string
  created_at: string
  content: string
  leads?: { company_name?: string | null; company_domain?: string | null; company_url?: string | null } | null
}): LatestPitch {
  return {
    pitchId: row.id,
    createdAt: row.created_at,
    content: row.content,
    company: {
      leadId: row.lead_id,
      companyName: row.leads?.company_name ?? null,
      companyDomain: row.leads?.company_domain ?? null,
      companyUrl: row.leads?.company_url ?? null,
      emailSequence: null,
      battleCard: null,
    },
  }
}

export async function listSavedReportsForUser(
  supabase: SupabaseClient,
  userId: string,
  opts?: { limit?: number }
): Promise<SavedReportSummary[]> {
  const limit = typeof opts?.limit === 'number' && opts.limit > 0 ? Math.min(opts.limit, 200) : 200

  const { data, error } = await supabase
    .from('pitches')
    .select(
      `
        id,
        lead_id,
        content,
        created_at,
        leads:lead_id (
          company_name,
          company_domain,
          company_url
        )
      `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !Array.isArray(data) || data.length === 0) return []

  return (data as Array<unknown>).flatMap((raw): SavedReportSummary[] => {
    const row = raw as
      | {
          id?: unknown
          lead_id?: unknown
          content?: unknown
          created_at?: unknown
          leads?: { company_name?: unknown; company_domain?: unknown; company_url?: unknown } | null
        }
      | null
    if (!row) return []

    const id = typeof row.id === 'string' ? row.id : null
    const leadId = typeof row.lead_id === 'string' ? row.lead_id : null
    const createdAtIso = typeof row.created_at === 'string' ? row.created_at : null
    const content = typeof row.content === 'string' ? row.content : ''
    if (!id || !leadId || !createdAtIso) return []

    const createdAtMs = Date.parse(createdAtIso)
    const createdAt = Number.isFinite(createdAtMs) ? new Date(createdAtMs) : new Date()

    const leads = (row.leads ?? null) as
      | {
          company_name?: unknown
          company_domain?: unknown
          company_url?: unknown
        }
      | null

    const companyNameRaw =
      (typeof leads?.company_name === 'string' && leads.company_name.trim()) ||
      (typeof leads?.company_domain === 'string' && leads.company_domain.trim()) ||
      (typeof leads?.company_url === 'string' && leads.company_url.trim()) ||
      'Unknown company'

    const deepLinkHref = buildLatestPitchDeepLink(
      toLatestPitchForDeepLink({
        id,
        lead_id: leadId,
        created_at: createdAtIso,
        content,
        leads: {
          company_name: typeof leads?.company_name === 'string' ? leads.company_name : null,
          company_domain: typeof leads?.company_domain === 'string' ? leads.company_domain : null,
          company_url: typeof leads?.company_url === 'string' ? leads.company_url : null,
        },
      })
    )

    return [
      {
        id,
        companyName: companyNameRaw,
        createdAt,
        previewBullets: extractPreviewBullets(content, 2),
        deepLinkHref,
      },
    ]
  })
}

