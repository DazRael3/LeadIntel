import { normalizeReportDraftInput } from '@/lib/reports/reportInput'

function safeTrim(v: string | null | undefined): string | null {
  if (!v) return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

export function buildCompetitiveReportNewUrl(args: {
  company?: string | null
  url?: string | null
  ticker?: string | null
  auto?: boolean
}): string {
  const params = new URLSearchParams()
  const normalized = normalizeReportDraftInput({
    company_name: safeTrim(args.company),
    input_url: safeTrim(args.url),
    ticker: safeTrim(args.ticker),
  })

  if (normalized.companyName) params.set('company', normalized.companyName)
  if (normalized.inputUrl) params.set('url', normalized.inputUrl)
  if (normalized.ticker) params.set('ticker', normalized.ticker)
  if (args.auto) params.set('auto', '1')

  const qs = params.toString()
  // Reports hub is the single landing page. It can auto-generate a report (auto=1)
  // and then redirect to the saved report.
  return qs.length > 0 ? `/competitive-report?${qs}` : '/competitive-report'
}

function looksLikeDomain(input: string): boolean {
  if (/\s/.test(input)) return false
  if (!input.includes('.')) return false
  // Very light heuristic: must have a dot and be mostly url-safe.
  return /^[a-z0-9][a-z0-9.\-\/]*$/i.test(input)
}

export function parseCompanyFromPitchInput(raw: string | null): { company: string | null; url: string | null } {
  const v = safeTrim(raw)
  if (!v) return { company: null, url: null }
  if (/^https?:\/\//i.test(v)) return { company: null, url: v }
  if (looksLikeDomain(v)) return { company: null, url: v }
  return { company: v, url: null }
}

