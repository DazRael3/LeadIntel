export type PlanName = 'free' | 'pro'

export type PlanContext = {
  plan: PlanName
  trial?: { active: boolean; endsAt: string | null }
}

export type Entitlements = {
  canUseCommandCenter: boolean
  canAccessPitchHistory: boolean
  canExportLeads: boolean
  isTrialActive: boolean
  isTrialExpiredNonPro: boolean
}

function isFutureIso(ts: string | null | undefined, nowMs: number): boolean {
  if (!ts) return false
  const ms = Date.parse(ts)
  return Number.isFinite(ms) && ms > nowMs
}

/**
 * Centralized “what can the user do?” logic derived from plan/trial.
 * This is intentionally conservative: if trial is not active and the user is not Pro,
 * access to saved work is locked, but never deleted.
 */
export function getEntitlements(ctx: PlanContext, nowMs: number = Date.now()): Entitlements {
  const trialEndsAt = ctx.trial?.endsAt ?? null
  const isTrialActive = Boolean(ctx.trial?.active) && isFutureIso(trialEndsAt, nowMs)
  const isPro = ctx.plan === 'pro'

  const canAccessPitchHistory = isPro || isTrialActive

  return {
    // Command Center remains usable for Free users (per product design).
    canUseCommandCenter: true,
    canAccessPitchHistory,
    canExportLeads: canAccessPitchHistory,
    isTrialActive,
    // We can’t reliably distinguish “never had trial” vs “expired” without additional server data;
    // treat “not pro + no active trial” as the locked state.
    isTrialExpiredNonPro: !isPro && !isTrialActive,
  }
}

