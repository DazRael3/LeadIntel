import { serverEnv } from '@/lib/env'

function flagEnabled(raw: string | undefined): boolean {
  const v = (raw ?? '').trim().toLowerCase()
  if (!v) return false
  return v === '1' || v === 'true'
}

export function lifecycleEmailsEnabled(): boolean {
  return flagEnabled(serverEnv.LIFECYCLE_EMAILS_ENABLED)
}

export function adminNotificationsEnabled(): boolean {
  return flagEnabled(serverEnv.LIFECYCLE_ADMIN_NOTIFICATIONS_ENABLED)
}

export function parseEmailCsv(raw: string | null | undefined): string[] {
  const v = (raw ?? '').trim()
  if (!v) return []
  return v
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s.includes('@') && s.includes('.'))
}

export function getLifecycleAdminEmails(): string[] {
  return parseEmailCsv(serverEnv.LIFECYCLE_ADMIN_EMAILS)
}

export function getFeedbackNotificationEmails(): string[] {
  const override = parseEmailCsv(serverEnv.FEEDBACK_NOTIFICATION_EMAILS)
  if (override.length > 0) return override
  return getLifecycleAdminEmails()
}

