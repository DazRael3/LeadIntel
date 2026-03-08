import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { serverEnv } from '@/lib/env'
import { refreshCompanySources } from '@/lib/sources/orchestrate'
import type { JobResult } from '@/lib/jobs/types'

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(n)))
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

type LeadRow = { company_name: string | null; company_domain: string | null; company_url: string | null }

export async function runSourcesRefresh(opts: { dryRun?: boolean; limit?: number }): Promise<Pick<JobResult, 'status' | 'summary'>> {
  const dryRun = Boolean(opts.dryRun)
  const limit = clamp(opts.limit ?? (serverEnv.SOURCES_REFRESH_LIMIT ?? 20), 1, 200)

  const admin = createSupabaseAdminClient({ schema: 'api' })
  const { data, error } = await admin
    .from('leads')
    .select('company_name, company_domain, company_url, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error) {
    return { status: 'error', summary: { error: 'leads_query_failed', message: error.message } }
  }

  const rows = (data ?? []) as Array<LeadRow & { created_at?: string }>
  const unique = new Map<string, { companyName: string; companyDomain: string | null; inputUrl: string | null }>()
  for (const r of rows) {
    const companyName = (r.company_name ?? '').trim()
    const companyDomain = (r.company_domain ?? '').trim() || null
    const inputUrl = (r.company_url ?? '').trim() || null
    const key = companyDomain || companyName.toLowerCase()
    if (!key || unique.has(key)) continue
    if (!companyName) continue
    unique.set(key, { companyName, companyDomain, inputUrl })
    if (unique.size >= limit) break
  }

  const targets = Array.from(unique.values())
  if (targets.length === 0) {
    return { status: 'skipped', summary: { reason: 'no_targets' } }
  }

  let refreshedCompanies = 0
  let sourcesOk = 0
  let sourcesError = 0
  const failures: Array<{ companyName: string; errorCode: string }> = []

  for (const t of targets) {
    if (dryRun) {
      refreshedCompanies++
      continue
    }
    const res = await refreshCompanySources({
      companyName: t.companyName,
      companyDomain: t.companyDomain,
      inputUrl: t.inputUrl,
      force: false,
    })
    if (!res.ok) {
      failures.push({ companyName: t.companyName, errorCode: res.errorCode })
      sourcesError++
    } else {
      refreshedCompanies++
      sourcesOk += res.data.refreshed.filter((s) => s.status === 'ok').length
      sourcesError += res.data.refreshed.filter((s) => s.status === 'error').length
    }
    // Light pacing to avoid hammering sources (especially SEC).
    await sleepMs(150)
  }

  return {
    status: failures.length > 0 ? 'ok' : 'ok',
    summary: {
      limit,
      targets: targets.length,
      refreshedCompanies,
      sourcesOk,
      sourcesError,
      failures: failures.slice(0, 10),
    },
  }
}

