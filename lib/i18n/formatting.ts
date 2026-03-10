import type { SupportedLocale } from '@/lib/i18n/types'
import { DEFAULT_LOCALE } from '@/lib/i18n/config'

function safeLocale(locale: SupportedLocale | null | undefined): SupportedLocale {
  return locale ?? DEFAULT_LOCALE
}

export function formatDateTime(iso: string | null, args?: { locale?: SupportedLocale; style?: 'short' | 'medium' }): string {
  if (!iso) return '—'
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return '—'
  const locale = safeLocale(args?.locale)
  const style = args?.style ?? 'medium'
  const opt: Intl.DateTimeFormatOptions =
    style === 'short'
      ? { year: 'numeric', month: '2-digit', day: '2-digit' }
      : { year: 'numeric', month: 'short', day: '2-digit' }
  return new Intl.DateTimeFormat(locale, opt).format(new Date(ms))
}

export function formatNumber(n: number | null | undefined, args?: { locale?: SupportedLocale; maximumFractionDigits?: number }): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—'
  const locale = safeLocale(args?.locale)
  return new Intl.NumberFormat(locale, { maximumFractionDigits: args?.maximumFractionDigits ?? 0 }).format(n)
}

