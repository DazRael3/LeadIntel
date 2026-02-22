import type { SupabaseClient } from '@supabase/supabase-js'
import { looksLikeDomain, makeNameCompanyKey } from '@/lib/company-key'

export type LatestPitchCompany = {
  leadId: string
  companyName: string | null
  companyDomain: string | null
  companyUrl: string | null
  emailSequence: unknown | null
  battleCard: unknown | null
}

export type LatestPitch = {
  pitchId: string
  createdAt: string
  content: string
  company: LatestPitchCompany
}

export type LatestPitchQuery = {
  userId: string
  companyDomain?: string | null
  companyName?: string | null
}

export async function getLatestPitchForUser(supabase: SupabaseClient, userId: string): Promise<LatestPitch | null> {
  const { data, error } = await supabase
    .from('pitches')
    .select(
      `
        id,
        lead_id,
        content,
        created_at,
        leads:lead_id (
          id,
          company_name,
          company_domain,
          company_url,
          email_sequence,
          battle_card
        )
      `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (error) return null
  const row = (Array.isArray(data) ? data[0] : null) as
    | {
        id: string
        lead_id: string
        content: string
        created_at: string
        leads?: {
          id?: string | null
          company_name?: string | null
          company_domain?: string | null
          company_url?: string | null
          email_sequence?: unknown
          battle_card?: unknown
        } | null
      }
    | null

  if (!row || !row.id || !row.lead_id || typeof row.content !== 'string' || !row.created_at) return null
  const leads = row.leads ?? null

  return {
    pitchId: row.id,
    createdAt: row.created_at,
    content: row.content,
    company: {
      leadId: row.lead_id,
      companyName: leads?.company_name ?? null,
      companyDomain: leads?.company_domain ?? null,
      companyUrl: leads?.company_url ?? null,
      emailSequence: (leads as { email_sequence?: unknown } | null)?.email_sequence ?? null,
      battleCard: (leads as { battle_card?: unknown } | null)?.battle_card ?? null,
    },
  }
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^www\./i, '').toLowerCase()
}

function escapeLike(input: string): string {
  // Minimal escaping for PostgREST ilike patterns.
  return input.replace(/[%_]/g, (m) => `\\${m}`)
}

export async function getLatestPitchForCompany(
  supabase: SupabaseClient,
  query: LatestPitchQuery
): Promise<LatestPitch | null> {
  const companyDomain = query.companyDomain ? normalizeDomain(query.companyDomain) : null
  const companyName = query.companyName?.trim() ? query.companyName.trim() : null

  if (!companyDomain && !companyName) return null

  const base = () =>
    supabase
      .from('pitches')
      .select(
        `
        id,
        lead_id,
        content,
        created_at,
        leads:lead_id (
          id,
          company_name,
          company_domain,
          company_url,
          email_sequence,
          battle_card
        )
      `
      )
      .eq('user_id', query.userId)

  let data: unknown[] | null = null
  let error: unknown = null

  if (companyDomain) {
    if (looksLikeDomain(companyDomain)) {
      const res = await base().eq('leads.company_domain', companyDomain).order('created_at', { ascending: false }).limit(1)
      data = res.data as unknown[] | null
      error = res.error
    } else {
      // Name-only "domain" queries can happen while the user types; try the deterministic name key first.
      const key = makeNameCompanyKey(companyDomain)
      const resKey = await base().eq('leads.company_domain', key).order('created_at', { ascending: false }).limit(1)
      if (!resKey.error && Array.isArray(resKey.data) && resKey.data.length > 0) {
        data = resKey.data as unknown[]
        error = resKey.error
      } else {
        const resName = await base()
          .ilike('leads.company_name', `%${escapeLike(companyDomain)}%`)
          .order('created_at', { ascending: false })
          .limit(1)
        data = resName.data as unknown[] | null
        error = resName.error
      }
    }
  } else if (companyName) {
    const res = await base().ilike('leads.company_name', `%${escapeLike(companyName)}%`).order('created_at', { ascending: false }).limit(1)
    data = res.data as unknown[] | null
    error = res.error
  }

  if (error) return null
  const row = (data?.[0] ?? null) as
    | {
        id: string
        lead_id: string
        content: string
        created_at: string
        leads?: {
          id?: string | null
          company_name?: string | null
          company_domain?: string | null
          company_url?: string | null
          email_sequence?: unknown
          battle_card?: unknown
        } | null
      }
    | null

  if (!row || !row.id || !row.lead_id || typeof row.content !== 'string' || !row.created_at) return null
  const leads = row.leads ?? null

  return {
    pitchId: row.id,
    createdAt: row.created_at,
    content: row.content,
    company: {
      leadId: row.lead_id,
      companyName: leads?.company_name ?? null,
      companyDomain: leads?.company_domain ?? null,
      companyUrl: leads?.company_url ?? null,
      emailSequence: (leads as { email_sequence?: unknown } | null)?.email_sequence ?? null,
      battleCard: (leads as { battle_card?: unknown } | null)?.battle_card ?? null,
    },
  }
}

