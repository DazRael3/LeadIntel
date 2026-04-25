import type { SupabaseClient } from '@supabase/supabase-js'
import { isHouseCloserEmail } from '@/lib/billing/houseAccounts'
import { productPlanForTier } from '@/lib/billing/product-plan'

const ACTIVE_STATUSES = ['active', 'trialing']

export type Plan = 'free' | 'pro'

export interface PlanDetails {
  plan: Plan
  /** Stable internal plan identifier for gating. */
  planId?: 'pro' | null
  /** Subscription status if known (from api.subscriptions). */
  subscriptionStatus?: string | null
  /** Trial end timestamp (ISO) if known and user is trialing. */
  trialEndsAt?: string | null
  /** Current period end timestamp (ISO) if known. */
  currentPeriodEndsAt?: string | null
  /** App-level trial end timestamp (ISO) if enabled and active. */
  appTrialEndsAt?: string | null
  /** True when effective Pro access is coming from app-level trial (not Stripe). */
  isAppTrial?: boolean
}

/**
 * Product tiers.
 *
 * Current product model supports:
 * - starter (free)
 * - closer (paid)
 * - closer_plus (paid)
 * - team (paid, seat-based)
 */
export type PlanTier = 'starter' | 'closer' | 'closer_plus' | 'team'

function isAppTrialEnabled(): boolean {
  const raw = (process.env.ENABLE_APP_TRIAL || '').trim().toLowerCase()
  return raw === '1' || raw === 'true'
}

function isFutureIso(ts: string | null | undefined, nowMs: number): boolean {
  if (!ts) return false
  const ms = Date.parse(ts)
  return Number.isFinite(ms) && ms > nowMs
}

async function getSessionEmailIfHouseOverrideEnabled(supabase: SupabaseClient): Promise<string | null> {
  const rawHouse = (process.env.HOUSE_CLOSER_EMAILS ?? '').trim()
  if (!rawHouse) return null
  try {
    const auth = (supabase as unknown as { auth?: { getUser?: () => Promise<unknown> } }).auth
    const getUser = auth?.getUser
    if (typeof getUser !== 'function') return null
    const res = (await getUser()) as { data?: { user?: { email?: string | null } | null } | null } | undefined
    const email = res?.data?.user?.email ?? null
    return typeof email === 'string' && email.trim().length > 0 ? email : null
  } catch {
    return null
  }
}

export async function getPlan(supabase: SupabaseClient, userId: string): Promise<Plan> {
  // House Closer override: treat specific session emails as Pro even without Stripe rows.
  const rawHouse = (process.env.HOUSE_CLOSER_EMAILS ?? '').trim()
  if (rawHouse) {
    const email = await getSessionEmailIfHouseOverrideEnabled(supabase)
    if (isHouseCloserEmail(email, rawHouse)) return 'pro'
  }

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .in('status', ACTIVE_STATUSES)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sub && ACTIVE_STATUSES.includes(sub.status)) {
    return 'pro'
  }

  const { data: userRow } = await supabase
    .from('users')
    .select('subscription_tier')
    .eq('id', userId)
    .maybeSingle()

  if (
    userRow?.subscription_tier === 'pro' ||
    userRow?.subscription_tier === 'closer_plus' ||
    userRow?.subscription_tier === 'team'
  ) {
    return 'pro'
  }

  return 'free'
}

export async function isPro(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return (await getPlanDetails(supabase, userId)).plan === 'pro'
}

/**
 * Fetch richer plan details for UI (plan + trial info).
 *
 * Important: This function is resilient to schema drift (missing columns) and will
 * fall back to `getPlan()` if advanced fields are unavailable.
 */
export async function getPlanDetails(supabase: SupabaseClient, userId: string): Promise<PlanDetails> {
  // House Closer override: use the auth session email first, before any DB reads.
  // This ensures Pro gating works even when there is no Stripe subscription row.
  const rawHouse = (process.env.HOUSE_CLOSER_EMAILS ?? '').trim()
  if (rawHouse) {
    const email = await getSessionEmailIfHouseOverrideEnabled(supabase)
    if (isHouseCloserEmail(email, rawHouse)) {
      return { plan: 'pro', planId: 'pro', isAppTrial: false, appTrialEndsAt: null }
    }
  }

  // Try to read richer subscription fields (these may be added by later migrations).
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('status, trial_end, current_period_end')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const status = (sub as { status?: string | null } | null)?.status ?? null
    let plan: Plan = status && ACTIVE_STATUSES.includes(status) ? 'pro' : await getPlan(supabase, userId)
    let appTrialEndsAt: string | null = null
    let isAppTrial = false

    if (plan === 'free' && isAppTrialEnabled()) {
      try {
        const { data: userRow } = await supabase
          .from('users')
          .select('trial_ends_at')
          .eq('id', userId)
          .maybeSingle()

        const trialEnds = (userRow as { trial_ends_at?: string | null } | null)?.trial_ends_at ?? null
        if (isFutureIso(trialEnds, Date.now())) {
          plan = 'pro'
          appTrialEndsAt = trialEnds
          isAppTrial = true
        }
      } catch {
        // Schema drift tolerance: if trial columns don't exist, skip silently.
      }
    }

    return {
      plan,
      planId: plan === 'pro' ? 'pro' : null,
      subscriptionStatus: status,
      trialEndsAt: (sub as { trial_end?: string | null } | null)?.trial_end ?? null,
      currentPeriodEndsAt: (sub as { current_period_end?: string | null } | null)?.current_period_end ?? null,
      appTrialEndsAt,
      isAppTrial,
    }
  } catch {
    const plan = await getPlan(supabase, userId)
    return { plan, planId: plan === 'pro' ? 'pro' : null }
  }
}

/**
 * Display-only plan metadata for UI (copy only; does not affect billing).
 *
 * Mapping:
 * - free -> Starter (Free, limited)
 * - pro  -> Closer ($79 / month)
 *
 * Legacy note: "team" is deprecated and treated as "closer".
 */
export type DisplayPlanMeta = {
  tier: PlanTier
  productPlan: 'free' | 'pro' | 'agency'
  creditsLabel: string
  planBubbleLabel: string
}

function normalizeTier(input: unknown): PlanTier {
  if (input === 'starter' || input === 'closer' || input === 'closer_plus' || input === 'team') return input
  // Backward compatibility: older code may pass the plan string.
  if (input === 'pro') return 'closer'
  return 'starter'
}

/**
 * Pure display metadata for Starter / Closer / Team.
 * Accepts either the /api/plan payload (preferred) or legacy plan strings.
 */
export function getDisplayPlanMeta(plan: { tier?: unknown; plan?: unknown } | Plan | null | undefined): DisplayPlanMeta {
  const tier =
    typeof plan === 'string'
      ? normalizeTier(plan)
      : normalizeTier((plan as { tier?: unknown } | null)?.tier)

  if (tier === 'starter') {
    return {
      tier,
      productPlan: 'free',
      creditsLabel: 'Starter (limited)',
      planBubbleLabel: 'Free',
    }
  }

  if (tier === 'closer') {
    return {
      tier,
      productPlan: 'pro',
      creditsLabel: '∞ Unlimited',
      planBubbleLabel: 'Pro · $79 / month',
    }
  }

  if (tier === 'closer_plus') {
    return {
      tier,
      productPlan: 'pro',
      creditsLabel: '∞ Unlimited',
      planBubbleLabel: 'Pro+ · $149 / month',
    }
  }

  return {
    tier: 'team',
    productPlan: 'agency',
    creditsLabel: '∞ Unlimited',
    planBubbleLabel: 'Agency · seat-based',
  }
}
