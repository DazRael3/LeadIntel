/**
 * Lead Library usage helpers.
 *
 * We keep a tiny, pure helper here so UI components can display consistent
 * "X of Y leads • Z credits remaining" numbers without duplicating math.
 *
 * NOTE: This file is intentionally display-focused; it does not enforce caps.
 */

export const STARTER_MAX_LEADS = 3

function clampInt(value: number, min: number, max: number): number {
  const n = Number.isFinite(value) ? Math.trunc(value) : 0
  return Math.max(min, Math.min(max, n))
}

export type StarterLeadUsage = {
  maxLeads: number
  leadsUsed: number
  creditsRemaining: number
}

/**
 * Starter plan lead usage model:
 * - maxLeads: cap for Starter
 * - leadsUsed: number of distinct unlocked leads (clamped to [0, maxLeads])
 * - creditsRemaining: maxLeads - rawUsed, clamped to [0, maxLeads]
 */
export function computeStarterLeadUsage(rawLeadsUsed: number, maxLeads: number = STARTER_MAX_LEADS): StarterLeadUsage {
  const safeMax = clampInt(maxLeads, 0, 10_000)
  const rawUsed = clampInt(rawLeadsUsed, 0, 1_000_000)

  const leadsUsed = clampInt(rawUsed, 0, safeMax)
  const creditsRemaining = clampInt(safeMax - rawUsed, 0, safeMax)

  return { maxLeads: safeMax, leadsUsed, creditsRemaining }
}

