export type QaTier = 'starter' | 'closer' | 'closer_plus' | 'team'

function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
}

export function isQaOverrideUiEnabled(): boolean {
  const v = (process.env.ENABLE_QA_OVERRIDES ?? '').trim().toLowerCase()
  return v === '1' || v === 'true'
}

export function isQaActorAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  const allow = parseAllowlist(process.env.QA_OVERRIDE_ACTOR_EMAILS)
  if (allow.length > 0) return allow.includes(e)
  // Safe default: only same-domain internal users.
  return e.endsWith('@dazrael.com')
}

export function isQaTargetAllowed(email: string | null | undefined): boolean {
  if (!email) return false
  const e = email.trim().toLowerCase()
  const allow = parseAllowlist(process.env.QA_OVERRIDE_TARGET_EMAILS)
  if (allow.length > 0) return allow.includes(e)
  // Safe default: only same-domain internal users.
  return e.endsWith('@dazrael.com')
}

export function parseQaTier(value: unknown): QaTier | null {
  if (value === 'starter' || value === 'closer' || value === 'closer_plus' || value === 'team') return value
  return null
}

