import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { SourceType, NormalizedCitation } from '@/lib/sources/normalize'
import { normalizeCitations } from '@/lib/sources/normalize'

export type SnapshotStatus = 'ok' | 'error'

export type CompanySourceSnapshotRow = {
  id: string
  created_at: string
  company_key: string
  source_type: SourceType
  fetched_at: string
  expires_at: string
  status: SnapshotStatus
  payload: unknown
  citations: unknown
  meta: unknown
}

export type SnapshotWrite = {
  companyKey: string
  sourceType: SourceType
  fetchedAt: string
  expiresAt: string
  status: SnapshotStatus
  payload: unknown
  citations: NormalizedCitation[]
  meta: Record<string, unknown>
}

export const DEFAULT_TTL_HOURS: Record<SourceType, number> = {
  gdelt: 6,
  first_party: 12,
  greenhouse: 24,
  lever: 24,
  sec: 24,
}

function nowIso(): string {
  return new Date().toISOString()
}

function addHoursIso(hours: number): string {
  const d = new Date()
  d.setTime(d.getTime() + hours * 60 * 60 * 1000)
  return d.toISOString()
}

export async function upsertCompanyProfile(args: {
  companyKey: string
  companyName: string
  companyDomain: string | null
  inputUrl: string | null
}): Promise<{ ok: true } | { ok: false; errorCode: string; message: string }> {
  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { error } = await admin.from('company_profiles').upsert(
      {
        company_key: args.companyKey,
        company_name: args.companyName,
        company_domain: args.companyDomain,
        input_url: args.inputUrl,
      },
      { onConflict: 'company_key' }
    )
    if (error) return { ok: false, errorCode: error.code ?? 'db_error', message: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, errorCode: 'admin_client_unavailable', message: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function getFreshSnapshot(args: {
  companyKey: string
  sourceType: SourceType
}): Promise<{ ok: true; snapshot: CompanySourceSnapshotRow } | { ok: true; snapshot: null } | { ok: false; errorCode: string; message: string }> {
  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data, error } = await admin
      .from('company_source_snapshots')
      .select('id, created_at, company_key, source_type, fetched_at, expires_at, status, payload, citations, meta')
      .eq('company_key', args.companyKey)
      .eq('source_type', args.sourceType)
      .order('fetched_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) return { ok: false, errorCode: error.code ?? 'db_error', message: error.message }
    if (!data) return { ok: true, snapshot: null }
    const expiresAt = new Date((data as { expires_at: string }).expires_at).getTime()
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return { ok: true, snapshot: null }
    return { ok: true, snapshot: data as CompanySourceSnapshotRow }
  } catch (e) {
    return { ok: false, errorCode: 'admin_client_unavailable', message: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export async function writeSnapshot(input: SnapshotWrite): Promise<{ ok: true; id: string } | { ok: false; errorCode: string; message: string }> {
  try {
    const admin = createSupabaseAdminClient({ schema: 'api' })
    const { data, error } = await admin
      .from('company_source_snapshots')
      .insert({
        company_key: input.companyKey,
        source_type: input.sourceType,
        fetched_at: input.fetchedAt,
        expires_at: input.expiresAt,
        status: input.status,
        payload: input.payload ?? {},
        citations: normalizeCitations(input.citations),
        meta: input.meta ?? {},
      })
      .select('id')
      .single()
    if (error) return { ok: false, errorCode: error.code ?? 'db_error', message: error.message }
    return { ok: true, id: (data as { id: string }).id }
  } catch (e) {
    return { ok: false, errorCode: 'admin_client_unavailable', message: e instanceof Error ? e.message : 'Unknown error' }
  }
}

export function defaultSnapshotTimes(sourceType: SourceType): { fetchedAt: string; expiresAt: string } {
  const fetchedAt = nowIso()
  const ttlHours = DEFAULT_TTL_HOURS[sourceType] ?? 12
  const expiresAt = addHoursIso(ttlHours)
  return { fetchedAt, expiresAt }
}

