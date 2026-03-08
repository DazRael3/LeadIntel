import type { SourceType, NormalizedCitation } from '@/lib/sources/normalize'
import { normalizeCompanyKey, normalizeCitations } from '@/lib/sources/normalize'
import { getFreshSnapshot, upsertCompanyProfile, writeSnapshot, DEFAULT_TTL_HOURS } from '@/lib/sources/cache'
import { fetchFirstPartySignals } from '@/lib/sources/firstParty'
import { fetchHiringSignals } from '@/lib/sources/jobs'
import { fetchGdeltNews } from '@/lib/sources/gdelt'
import { fetchSecFilings } from '@/lib/sources/sec'

export type RefreshResult = {
  companyKey: string
  refreshed: Array<{ sourceType: SourceType; status: 'ok' | 'error'; fetchedAt: string; expiresAt: string; citationsCount: number }>
  failed: Array<{ sourceType: SourceType; errorCode: string }>
  fetchedAt: string
}

export type SourcesBundle = {
  companyKey: string
  fetchedAt: string
  sources: Partial<
    Record<
      SourceType,
      {
        status: 'ok' | 'error'
        fetchedAt: string
        expiresAt: string
        payload: unknown
        citations: NormalizedCitation[]
        meta: Record<string, unknown>
      }
    >
  >
  allCitations: NormalizedCitation[]
}

async function maybeUseCache(args: { companyKey: string; sourceType: SourceType; force: boolean }) {
  if (args.force) return null
  const cached = await getFreshSnapshot({ companyKey: args.companyKey, sourceType: args.sourceType })
  if (!cached.ok) return null
  if (!cached.snapshot) return null
  return cached.snapshot
}

function toIso(d: Date): string {
  return d.toISOString()
}

function computeExpiresAt(sourceType: SourceType): string {
  const hours = DEFAULT_TTL_HOURS[sourceType] ?? 12
  const d = new Date(Date.now() + hours * 60 * 60 * 1000)
  return toIso(d)
}

export async function refreshCompanySources(args: {
  companyName: string
  companyDomain?: string | null
  inputUrl?: string | null
  force?: boolean
}): Promise<{ ok: true; data: RefreshResult; bundle: SourcesBundle } | { ok: false; errorCode: string; message: string }> {
  const normalized = normalizeCompanyKey({
    companyName: args.companyName,
    companyDomain: args.companyDomain ?? null,
    inputUrl: args.inputUrl ?? null,
  })
  const companyKey = normalized.companyKey
  const fetchedAt = new Date().toISOString()
  const force = Boolean(args.force)

  const profile = await upsertCompanyProfile({
    companyKey,
    companyName: normalized.companyName,
    companyDomain: normalized.companyDomain,
    inputUrl: normalized.inputUrl,
  })
  if (!profile.ok) {
    return { ok: false, errorCode: profile.errorCode, message: profile.message }
  }

  const refreshed: RefreshResult['refreshed'] = []
  const failed: RefreshResult['failed'] = []
  const sources: SourcesBundle['sources'] = {}

  // 1) First-party (lightweight, also helps jobs detection)
  {
    const sourceType: SourceType = 'first_party'
    const cached = await maybeUseCache({ companyKey, sourceType, force })
    if (cached) {
      const citations = normalizeCitations((cached.citations as NormalizedCitation[]) ?? [])
      sources[sourceType] = {
        status: cached.status,
        fetchedAt: cached.fetched_at,
        expiresAt: cached.expires_at,
        payload: cached.payload,
        citations,
        meta: (cached.meta as Record<string, unknown>) ?? {},
      }
    } else {
      const res = await fetchFirstPartySignals({ companyDomain: normalized.companyDomain, inputUrl: normalized.inputUrl })
      const expiresAt = computeExpiresAt(sourceType)
      const write = await writeSnapshot({
        companyKey,
        sourceType,
        fetchedAt,
        expiresAt,
        status: res.ok ? 'ok' : 'error',
        payload: res.payload,
        citations: res.ok ? res.citations : [],
        meta: res.meta ?? {},
      })
      if (!write.ok) {
        failed.push({ sourceType, errorCode: write.errorCode })
      } else {
        refreshed.push({
          sourceType,
          status: res.ok ? 'ok' : 'error',
          fetchedAt,
          expiresAt,
          citationsCount: res.ok ? res.citations.length : 0,
        })
      }
      sources[sourceType] = {
        status: res.ok ? 'ok' : 'error',
        fetchedAt,
        expiresAt,
        payload: res.payload,
        citations: res.ok ? res.citations : [],
        meta: { ...(res.meta ?? {}), write: write.ok ? 'ok' : 'error', writeErrorCode: write.ok ? undefined : write.errorCode },
      }
    }
  }

  // 2) Jobs (Greenhouse/Lever)
  {
    const jobsRes = await fetchHiringSignals({ companyDomain: normalized.companyDomain, inputUrl: normalized.inputUrl })
    if (jobsRes.ok) {
      const sourceType: SourceType = jobsRes.sourceType
      const cached = await maybeUseCache({ companyKey, sourceType, force })
      if (cached) {
        const citations = normalizeCitations((cached.citations as NormalizedCitation[]) ?? [])
        sources[sourceType] = {
          status: cached.status,
          fetchedAt: cached.fetched_at,
          expiresAt: cached.expires_at,
          payload: cached.payload,
          citations,
          meta: (cached.meta as Record<string, unknown>) ?? {},
        }
      } else {
        const expiresAt = computeExpiresAt(sourceType)
        const write = await writeSnapshot({
          companyKey,
          sourceType,
          fetchedAt,
          expiresAt,
          status: 'ok',
          payload: jobsRes.payload,
          citations: jobsRes.citations,
          meta: jobsRes.meta ?? {},
        })
        if (!write.ok) failed.push({ sourceType, errorCode: write.errorCode })
        refreshed.push({ sourceType, status: 'ok', fetchedAt, expiresAt, citationsCount: jobsRes.citations.length })
        sources[sourceType] = {
          status: 'ok',
          fetchedAt,
          expiresAt,
          payload: jobsRes.payload,
          citations: jobsRes.citations,
          meta: { ...(jobsRes.meta ?? {}), write: write.ok ? 'ok' : 'error', writeErrorCode: write.ok ? undefined : write.errorCode },
        }
      }
    } else {
      // Record an error snapshot for both greenhouse/lever? Keep as no-op to avoid noise.
    }
  }

  // 3) GDELT news
  {
    const sourceType: SourceType = 'gdelt'
    const cached = await maybeUseCache({ companyKey, sourceType, force })
    if (cached) {
      const citations = normalizeCitations((cached.citations as NormalizedCitation[]) ?? [])
      sources[sourceType] = {
        status: cached.status,
        fetchedAt: cached.fetched_at,
        expiresAt: cached.expires_at,
        payload: cached.payload,
        citations,
        meta: (cached.meta as Record<string, unknown>) ?? {},
      }
    } else {
      const res = await fetchGdeltNews({ companyName: normalized.companyName, companyDomain: normalized.companyDomain })
      const expiresAt = computeExpiresAt(sourceType)
      const write = await writeSnapshot({
        companyKey,
        sourceType,
        fetchedAt,
        expiresAt,
        status: res.ok ? 'ok' : 'error',
        payload: res.payload,
        citations: res.ok ? res.citations : [],
        meta: res.meta ?? {},
      })
      if (!write.ok) failed.push({ sourceType, errorCode: write.errorCode })
      refreshed.push({ sourceType, status: res.ok ? 'ok' : 'error', fetchedAt, expiresAt, citationsCount: res.ok ? res.citations.length : 0 })
      sources[sourceType] = {
        status: res.ok ? 'ok' : 'error',
        fetchedAt,
        expiresAt,
        payload: res.payload,
        citations: res.ok ? res.citations : [],
        meta: { ...(res.meta ?? {}), write: write.ok ? 'ok' : 'error', writeErrorCode: write.ok ? undefined : write.errorCode },
      }
    }
  }

  // 4) SEC filings (best-effort; only if match found)
  {
    const sourceType: SourceType = 'sec'
    const cached = await maybeUseCache({ companyKey, sourceType, force })
    if (cached) {
      const citations = normalizeCitations((cached.citations as NormalizedCitation[]) ?? [])
      sources[sourceType] = {
        status: cached.status,
        fetchedAt: cached.fetched_at,
        expiresAt: cached.expires_at,
        payload: cached.payload,
        citations,
        meta: (cached.meta as Record<string, unknown>) ?? {},
      }
    } else {
      const res = await fetchSecFilings({ companyName: normalized.companyName })
      const expiresAt = computeExpiresAt(sourceType)
      const write = await writeSnapshot({
        companyKey,
        sourceType,
        fetchedAt,
        expiresAt,
        status: res.ok ? 'ok' : 'error',
        payload: res.payload,
        citations: res.ok ? res.citations : [],
        meta: res.meta ?? {},
      })
      if (!write.ok) failed.push({ sourceType, errorCode: write.errorCode })
      refreshed.push({ sourceType, status: res.ok ? 'ok' : 'error', fetchedAt, expiresAt, citationsCount: res.ok ? res.citations.length : 0 })
      sources[sourceType] = {
        status: res.ok ? 'ok' : 'error',
        fetchedAt,
        expiresAt,
        payload: res.payload,
        citations: res.ok ? res.citations : [],
        meta: { ...(res.meta ?? {}), write: write.ok ? 'ok' : 'error', writeErrorCode: write.ok ? undefined : write.errorCode },
      }
    }
  }

  const allCitations = normalizeCitations(
    Object.values(sources)
      .flatMap((s) => (s?.citations ?? []) as NormalizedCitation[])
      .filter(Boolean)
  )

  return {
    ok: true,
    data: { companyKey, refreshed, failed, fetchedAt },
    bundle: { companyKey, fetchedAt, sources, allCitations },
  }
}

