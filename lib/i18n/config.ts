import type { SupportedLocale } from '@/lib/i18n/types'

export const DEFAULT_LOCALE: SupportedLocale = 'en-US'
export const SUPPORTED_LOCALES: SupportedLocale[] = [DEFAULT_LOCALE]

export function isSupportedLocale(x: string | null | undefined): x is SupportedLocale {
  return x === 'en-US'
}

