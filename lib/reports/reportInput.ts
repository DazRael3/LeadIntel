import { normalizeCompanyDomain, normalizeInputUrl } from '@/lib/sources/normalize'

export const MIN_CITATIONS = 2

export type ReportInput = {
  company_name?: string | null
  input_url?: string | null
  company_domain?: string | null
  ticker?: string | null
}

function safeTrim(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length > 0 ? s : null
}

function slug(input: string): string {
  return input
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

const TICKER_RE = /^[A-Z0-9][A-Z0-9.\-]{0,10}$/

export function normalizeReportInput(raw: unknown): {
  companyName: string | null
  inputUrl: string | null
  companyDomain: string | null
  ticker: string | null
  companyKey: string
} {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const companyName = safeTrim(obj.company_name)?.slice(0, 120) ?? null
  const inputUrl = safeTrim(obj.input_url)
  const normalizedInputUrl = inputUrl ? normalizeInputUrl(inputUrl) : null

  const domainFromUrl = normalizedInputUrl
    ? (() => {
        try {
          return new URL(normalizedInputUrl).hostname.replace(/^www\./i, '').toLowerCase()
        } catch {
          return null
        }
      })()
    : null

  const domainFromField = safeTrim(obj.company_domain)
  const normalizedDomain = domainFromUrl ?? (domainFromField ? normalizeCompanyDomain(domainFromField) : null)

  const tickerRaw = safeTrim(obj.ticker)
  const ticker = tickerRaw ? tickerRaw.toUpperCase() : null
  if (ticker && !TICKER_RE.test(ticker)) {
    throw new Error('VALIDATION_ERROR_INVALID_TICKER')
  }

  const companyKey =
    normalizedDomain
      ? normalizedDomain
      : ticker
        ? `ticker:${ticker}`
        : companyName
          ? `name:${slug(companyName)}`
          : (() => {
              throw new Error('VALIDATION_ERROR_MISSING_INPUT')
            })()

  return {
    companyName,
    inputUrl: normalizedInputUrl,
    companyDomain: normalizedDomain,
    ticker,
    companyKey,
  }
}

