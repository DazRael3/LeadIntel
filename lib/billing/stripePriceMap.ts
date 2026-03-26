/**
 * Server-only helpers for mapping Stripe price IDs <-> app tiers/plans.
 *
 * IMPORTANT:
 * - Do not import this from client components (it reads process.env).
 * - All env vars here are OPTIONAL; missing config should fail gracefully in checkout
 *   (CHECKOUT_NOT_CONFIGURED), while plan resolution should fall back to "closer"
 *   for unknown paid price IDs.
 */

export type BillingCycle = 'monthly' | 'annual'
export { planIdForTier, tierAtLeast, tierLabel, type PaidPlanId, type PaidTier, type Tier } from '@/lib/billing/tier'
import { planIdForTier, type PaidPlanId, type Tier } from '@/lib/billing/tier'

function norm(v: string | null | undefined): string | null {
  const s = (v ?? '').trim()
  return s.length > 0 ? s : null
}

function envPrice(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    const n = norm(c)
    if (n) return n
  }
  return null
}

export function getPriceIdsFromEnv() {
  return {
    closerMonthly: envPrice(process.env.STRIPE_PRICE_ID_PRO, process.env.STRIPE_PRICE_ID),
    closerAnnual: envPrice(process.env.STRIPE_PRICE_ID_CLOSER_ANNUAL),
    closerPlusMonthly: envPrice(process.env.STRIPE_PRICE_ID_CLOSER_PLUS),
    closerPlusAnnual: envPrice(process.env.STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL),
    // Team: support either a single price (legacy) or base+seat split.
    teamMonthly: envPrice(process.env.STRIPE_PRICE_ID_TEAM),
    teamAnnual: envPrice(process.env.STRIPE_PRICE_ID_TEAM_ANNUAL),
    teamBaseMonthly: envPrice(process.env.STRIPE_PRICE_ID_TEAM_BASE),
    teamBaseAnnual: envPrice(process.env.STRIPE_PRICE_ID_TEAM_BASE_ANNUAL),
    teamSeatMonthly: envPrice(process.env.STRIPE_PRICE_ID_TEAM_SEAT),
    teamSeatAnnual: envPrice(process.env.STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL),
  } as const
}

// tierLabel/tierAtLeast/planIdForTier are re-exported from lib/billing/tier

export function resolveTierFromStripePriceId(priceId: string | null | undefined): Tier | null {
  const id = norm(priceId)
  if (!id) return null
  const env = getPriceIdsFromEnv()

  const closerIds = new Set([env.closerMonthly, env.closerAnnual].filter(Boolean) as string[])
  const closerPlusIds = new Set([env.closerPlusMonthly, env.closerPlusAnnual].filter(Boolean) as string[])
  const teamIds = new Set(
    [
      env.teamMonthly,
      env.teamAnnual,
      env.teamBaseMonthly,
      env.teamBaseAnnual,
      env.teamSeatMonthly,
      env.teamSeatAnnual,
    ].filter(Boolean) as string[]
  )

  if (teamIds.has(id)) return 'team'
  if (closerPlusIds.has(id)) return 'closer_plus'
  if (closerIds.has(id)) return 'closer'
  return null
}

export type CheckoutLineItem = { price: string; quantity: number }
export type CheckoutPriceResolution =
  | { ok: true; lineItems: CheckoutLineItem[] }
  | { ok: false; missing: string[] }

export function resolveCheckoutLineItems(planId: PaidPlanId, cycle: BillingCycle, seats?: number): CheckoutPriceResolution {
  const env = getPriceIdsFromEnv()
  const missing: string[] = []

  if (planId === 'pro') {
    const price = cycle === 'annual' ? env.closerAnnual : env.closerMonthly
    if (!price) {
      missing.push(cycle === 'annual' ? 'STRIPE_PRICE_ID_CLOSER_ANNUAL' : 'STRIPE_PRICE_ID_PRO (or STRIPE_PRICE_ID)')
      return { ok: false, missing }
    }
    return { ok: true, lineItems: [{ price, quantity: 1 }] }
  }

  if (planId === 'closer_plus') {
    const price = cycle === 'annual' ? env.closerPlusAnnual : env.closerPlusMonthly
    if (!price) {
      missing.push(cycle === 'annual' ? 'STRIPE_PRICE_ID_CLOSER_PLUS_ANNUAL' : 'STRIPE_PRICE_ID_CLOSER_PLUS')
      return { ok: false, missing }
    }
    return { ok: true, lineItems: [{ price, quantity: 1 }] }
  }

  // Team
  const qty = typeof seats === 'number' && Number.isFinite(seats) ? Math.max(1, Math.floor(seats)) : 1

  // Prefer base+seat if configured; otherwise use single team price with quantity.
  const base = cycle === 'annual' ? env.teamBaseAnnual : env.teamBaseMonthly
  const seat = cycle === 'annual' ? env.teamSeatAnnual : env.teamSeatMonthly
  if (base && seat) {
    return { ok: true, lineItems: [{ price: base, quantity: 1 }, { price: seat, quantity: qty }] }
  }

  const single = cycle === 'annual' ? env.teamAnnual : env.teamMonthly
  if (!single) {
    missing.push(
      cycle === 'annual'
        ? 'STRIPE_PRICE_ID_TEAM_ANNUAL (or STRIPE_PRICE_ID_TEAM_BASE_ANNUAL + STRIPE_PRICE_ID_TEAM_SEAT_ANNUAL)'
        : 'STRIPE_PRICE_ID_TEAM (or STRIPE_PRICE_ID_TEAM_BASE + STRIPE_PRICE_ID_TEAM_SEAT)'
    )
    return { ok: false, missing }
  }

  return { ok: true, lineItems: [{ price: single, quantity: qty }] }
}

