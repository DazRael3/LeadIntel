export type QaTier = 'starter' | 'closer' | 'closer_plus' | 'team'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type QaOverrideConfig = {
  enabled: boolean
  configured: boolean
  actorEmails: string[]
  targetEmails: string[]
  misconfigReason: string | null
}

function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return []
  const items = raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  // Keep only valid-looking emails and de-dupe.
  return Array.from(new Set(items.filter((s) => EMAIL_RE.test(s))))
}

export function isQaOverrideUiEnabled(): boolean {
  const v = (process.env.ENABLE_QA_OVERRIDES ?? '').trim().toLowerCase()
  return v === '1' || v === 'true'
}

export function getQaOverrideConfig(): QaOverrideConfig {
  const enabled = isQaOverrideUiEnabled()
  const actorEmails = parseAllowlist(process.env.QA_OVERRIDE_ACTOR_EMAILS)
  const targetEmails = parseAllowlist(process.env.QA_OVERRIDE_TARGET_EMAILS)
  const configured = actorEmails.length > 0 && targetEmails.length > 0

  let misconfigReason: string | null = null
  if (enabled && !configured) {
    misconfigReason =
      actorEmails.length === 0 && targetEmails.length === 0
        ? 'Explicit allowlists are not configured.'
        : actorEmails.length === 0
          ? 'QA_OVERRIDE_ACTOR_EMAILS is missing or empty.'
          : 'QA_OVERRIDE_TARGET_EMAILS is missing or empty.'
  }

  return { enabled, configured, actorEmails, targetEmails, misconfigReason }
}

export function isQaActorAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false
  const cfg = getQaOverrideConfig()
  const e = email.trim().toLowerCase()
  return cfg.actorEmails.includes(e)
}

export function isQaTargetAllowlisted(email: string | null | undefined): boolean {
  if (!email) return false
  const cfg = getQaOverrideConfig()
  const e = email.trim().toLowerCase()
  return cfg.targetEmails.includes(e)
}

export function isQaActorAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const cfg = getQaOverrideConfig()
  if (!cfg.enabled) return false
  if (!cfg.configured) return false
  const e = email.trim().toLowerCase()
  return cfg.actorEmails.includes(e)
}

export function isQaTargetAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const cfg = getQaOverrideConfig()
  if (!cfg.enabled) return false
  if (!cfg.configured) return false
  const e = email.trim().toLowerCase()
  return cfg.targetEmails.includes(e)
}

export function parseQaTier(value: unknown): QaTier | null {
  if (value === 'starter' || value === 'closer' || value === 'closer_plus' || value === 'team') return value
  return null
}

