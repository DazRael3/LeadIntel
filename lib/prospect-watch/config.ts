import { serverEnv } from '@/lib/env'
import { parseEmailCsv } from '@/lib/lifecycle/config'

function flagEnabled(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v) return false
  return v === '1' || v === 'true'
}

export function prospectWatchEnabled(): boolean {
  return flagEnabled(serverEnv.PROSPECT_WATCH_ENABLED)
}

export function prospectDailyDigestEnabled(): boolean {
  const v = (serverEnv.PROSPECT_WATCH_DAILY_DIGEST_ENABLED ?? '').trim().toLowerCase()
  return v === '1' || v === 'true'
}

export function contentDailyDigestEnabled(): boolean {
  const v = (serverEnv.PROSPECT_WATCH_CONTENT_DIGEST_ENABLED ?? '').trim().toLowerCase()
  return v === '1' || v === 'true'
}

export function highPriorityEnabled(): boolean {
  const v = (serverEnv.PROSPECT_WATCH_HIGH_PRIORITY_ENABLED ?? '').trim().toLowerCase()
  if (!v) return false
  return v === '1' || v === 'true'
}

export function highPriorityThreshold(): number {
  const n = serverEnv.PROSPECT_WATCH_HIGH_PRIORITY_THRESHOLD
  return typeof n === 'number' ? n : 92
}

export function getReviewEmails(): string[] {
  return parseEmailCsv(serverEnv.PROSPECT_WATCH_REVIEW_EMAILS)
}

export function getRssFeeds(): string[] {
  const raw = (serverEnv.PROSPECT_WATCH_RSS_FEEDS ?? '').trim()
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((u) => u.startsWith('http://') || u.startsWith('https://'))
}

export function externalSendEnabled(): boolean {
  const v = (serverEnv.PROSPECT_WATCH_EXTERNAL_SEND_ENABLED ?? '').trim().toLowerCase()
  if (!v) return false
  return v === '1' || v === 'true'
}

