export type NudgeKey =
  | 'upgrade_after_checklist'
  | 'upgrade_accounts_limit'

const SESSION_KEY = 'leadintel_upgrade_nudge_shown_session'

function nowMs(): number {
  return Date.now()
}

export function shouldShowUpgradeNudge(args: { key: NudgeKey; minHoursBetween: number }): boolean {
  if (typeof window === 'undefined') return false
  try {
    const sessionShown = sessionStorage.getItem(SESSION_KEY) === '1'
    if (sessionShown) return false
  } catch {
    // ignore
  }

  try {
    const k = `leadintel_nudge_${args.key}_last_shown_at`
    const last = localStorage.getItem(k)
    if (!last) return true
    const ms = Date.parse(last)
    if (!Number.isFinite(ms)) return true
    const hours = (nowMs() - ms) / (1000 * 60 * 60)
    return hours >= args.minHoursBetween
  } catch {
    return true
  }
}

export function markUpgradeNudgeShown(args: { key: NudgeKey }): void {
  if (typeof window === 'undefined') return
  const iso = new Date().toISOString()
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(`leadintel_nudge_${args.key}_last_shown_at`, iso)
  } catch {
    // ignore
  }
}

