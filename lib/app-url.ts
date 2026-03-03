import { serverEnv } from '@/lib/env'

export function getAppUrl(): string {
  const fromAppUrl = (serverEnv.APP_URL ?? '').trim()
  if (fromAppUrl) return fromAppUrl.replace(/\/$/, '')

  const fromSite = (serverEnv.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (fromSite) return fromSite.replace(/\/$/, '')

  return 'https://dazrael.com'
}

/**
 * Client-safe base URL helper.
 *
 * - Prefers NEXT_PUBLIC_SITE_URL when set (useful for production copy/paste snippets).
 * - Falls back to window.location.origin in the browser.
 * - Final fallback is localhost for local dev/test.
 */
export function getAppBaseUrl(): string {
  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || '').trim()
  if (envUrl) return envUrl.replace(/\/+$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return 'http://localhost:3000'
}

