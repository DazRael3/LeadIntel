'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { BuildInfo } from '@/lib/debug/buildInfo'
import { createClient } from '@/lib/supabase/client'
import { getUserSafe } from '@/lib/supabase/safe-auth'
import type { Capabilities } from '@/lib/billing/capabilities'
import { getTierCapabilities } from '@/lib/billing/capabilities'

type Plan = 'free' | 'pro'
type Tier = 'starter' | 'closer' | 'closer_plus' | 'team'

export function computeIsPro(plan: Plan, tier: Tier): boolean {
  return plan === 'pro' || tier !== 'starter'
}

interface PlanContextValue {
  plan: Plan
  tier: Tier
  planId: string | null
  isHouseCloserOverride: boolean
  isQaTierOverride: boolean
  qaOverride: { tier: Tier; expiresAt: string | null } | null
  qaDebugEligible: boolean
  debug:
    | {
        rawSubscriptionTier: string | null
        effectiveTier: Tier
        subscriptionStatus: string | null
        stripeTrialEnd: string | null
        qa: {
          enabled: boolean
          configured: boolean
          targetAllowlisted: boolean
          override: { tier: string | null; expiresAt: string | null; revokedAt: string | null } | null
          active: boolean
          blockedReason:
            | 'disabled'
            | 'misconfigured'
            | 'target_not_allowlisted'
            | 'stripe_active_or_trialing'
            | 'no_override_set'
            | 'revoked'
            | 'expired'
            | null
        }
      }
    | null
  buildInfo: BuildInfo | null
  isPro: boolean
  capabilities: Capabilities
  trial: { active: boolean; endsAt: string | null }
  loading: boolean
  refresh: () => Promise<void>
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined)

const fallbackPlanValue: PlanContextValue = {
  plan: 'free',
  tier: 'starter',
  planId: null,
  isHouseCloserOverride: false,
  isQaTierOverride: false,
  qaOverride: null,
  qaDebugEligible: false,
  debug: null,
  buildInfo: null,
  isPro: false,
  capabilities: getTierCapabilities('starter'),
  trial: { active: false, endsAt: null },
  loading: false,
  refresh: async () => {},
}

interface PlanProviderProps {
  initialPlan?: Plan
  initialBuildInfo?: BuildInfo | null
  children: React.ReactNode
}

export function PlanProvider({ initialPlan = 'free', initialBuildInfo = null, children }: PlanProviderProps) {
  const [plan, setPlan] = useState<Plan>(initialPlan)
  const [tier, setTier] = useState<Tier>('starter')
  const [planId, setPlanId] = useState<string | null>(null)
  const [capabilities, setCapabilities] = useState<Capabilities>(getTierCapabilities('starter'))
  const [isHouseCloserOverride, setIsHouseCloserOverride] = useState<boolean>(false)
  const [isQaTierOverride, setIsQaTierOverride] = useState<boolean>(false)
  const [qaOverride, setQaOverride] = useState<{ tier: Tier; expiresAt: string | null } | null>(null)
  const [qaDebugEligible, setQaDebugEligible] = useState<boolean>(false)
  const [debug, setDebug] = useState<PlanContextValue['debug']>(null)
  const [buildInfo] = useState<BuildInfo | null>(initialBuildInfo)
  const [trial, setTrial] = useState<{ active: boolean; endsAt: string | null }>({ active: false, endsAt: null })
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      // We avoid hitting /api/plan from anonymous public pages (noise + 401 spam).
      // However, some authenticated sessions are cookie-only (no localStorage session),
      // so Supabase JS may not detect "authed" even though /api/plan will succeed.
      const path = typeof window !== 'undefined' ? window.location.pathname : ''
      const isAuthedSurface =
        path.startsWith('/dashboard') ||
        path.startsWith('/settings') ||
        path.startsWith('/pitch') ||
        path.startsWith('/competitive-report') ||
        path.startsWith('/reports') ||
        path.startsWith('/success') ||
        path.startsWith('/onboarding')

      if (!isAuthedSurface) {
        // Public request hygiene: only call /api/plan when Supabase JS confirms a user session.
        let authed = false
        try {
          const supabase = createClient()
          const user = await getUserSafe(supabase)
          authed = Boolean(user)
        } catch {
          authed = false
        }
        if (!authed) {
          // Reset to safe public defaults.
          setPlan('free')
          setTier('starter')
          setPlanId(null)
          setCapabilities(getTierCapabilities('starter'))
          setIsHouseCloserOverride(false)
          setIsQaTierOverride(false)
          setQaOverride(null)
          setQaDebugEligible(false)
          setDebug(null)
          setTrial({ active: false, endsAt: null })
          return
        }
      }

      const resp = await fetch('/api/plan', { method: 'GET', cache: 'no-store' })
      if (!resp.ok) {
        // If the user is no longer authenticated, reset to safe defaults.
        if (resp.status === 401) {
          setPlan('free')
          setTier('starter')
          setPlanId(null)
          setCapabilities(getTierCapabilities('starter'))
          setIsHouseCloserOverride(false)
          setIsQaTierOverride(false)
          setQaOverride(null)
          setQaDebugEligible(false)
          setDebug(null)
          setTrial({ active: false, endsAt: null })
        }
        return
      }
      const text = await resp.text()
      if (!text || text.trim().length === 0) {
        // Fail-soft: avoid noisy runtime errors for transient network issues.
        // The UI will keep the last-known tier/plan (or safe defaults on first load).
        return
      }
      let data
      try {
        data = JSON.parse(text)
      } catch (parseError: unknown) {
        // Fail-soft: avoid noisy runtime errors; treat as transient.
        return
      }
      // Standard envelope: { ok: true, data: { plan, trial } }
      const payload = data?.data ?? data
      if (payload?.plan === 'pro' || payload?.plan === 'free') {
        setPlan(payload.plan)
      }
      // Product tiers are starter/closer. Treat legacy "team" as "closer" for backward compatibility.
      if (payload?.tier === 'starter' || payload?.tier === 'closer' || payload?.tier === 'closer_plus' || payload?.tier === 'team') {
        setTier(payload.tier)
        setCapabilities(getTierCapabilities(payload.tier))
      } else {
        // Safe default: treat unknown/missing as Starter.
        setTier('starter')
        setCapabilities(getTierCapabilities('starter'))
      }
      if (typeof payload?.planId === 'string') {
        setPlanId(payload.planId)
      } else {
        setPlanId(null)
      }
      if (typeof payload?.isHouseCloserOverride === 'boolean') {
        setIsHouseCloserOverride(payload.isHouseCloserOverride)
      } else {
        setIsHouseCloserOverride(false)
      }
      if (typeof payload?.isQaTierOverride === 'boolean') {
        setIsQaTierOverride(payload.isQaTierOverride)
      } else {
        setIsQaTierOverride(false)
      }
      if (payload?.qaOverride && typeof payload.qaOverride === 'object') {
        const q = payload.qaOverride as { tier?: unknown; expiresAt?: unknown }
        const qt = (q.tier === 'starter' || q.tier === 'closer' || q.tier === 'closer_plus' || q.tier === 'team') ? q.tier : null
        const exp = typeof q.expiresAt === 'string' ? q.expiresAt : null
        setQaOverride(qt ? { tier: qt, expiresAt: exp } : null)
      } else {
        setQaOverride(null)
      }
      setQaDebugEligible(Boolean(payload?.qaDebugEligible))
      if (payload?.debug && typeof payload.debug === 'object') {
        const d = payload.debug as Record<string, unknown>
        const effectiveTier =
          d.effectiveTier === 'starter' || d.effectiveTier === 'closer' || d.effectiveTier === 'closer_plus' || d.effectiveTier === 'team'
            ? (d.effectiveTier as Tier)
            : null
        const qa = typeof d.qa === 'object' && d.qa !== null ? (d.qa as Record<string, unknown>) : null
        const blockedReason = qa?.blockedReason
        const allowedBlocked =
          blockedReason === null ||
          blockedReason === 'disabled' ||
          blockedReason === 'misconfigured' ||
          blockedReason === 'target_not_allowlisted' ||
          blockedReason === 'stripe_active_or_trialing' ||
          blockedReason === 'no_override_set' ||
          blockedReason === 'revoked' ||
          blockedReason === 'expired'
            ? (blockedReason as PlanContextValue['debug'] extends { qa: { blockedReason: infer R } } ? R : never)
            : null
        setDebug({
          rawSubscriptionTier: typeof d.rawSubscriptionTier === 'string' ? d.rawSubscriptionTier : null,
          effectiveTier: effectiveTier ?? 'starter',
          subscriptionStatus: typeof d.subscriptionStatus === 'string' ? d.subscriptionStatus : null,
          stripeTrialEnd: typeof d.stripeTrialEnd === 'string' ? d.stripeTrialEnd : null,
          qa: {
            enabled: Boolean(qa?.enabled),
            configured: Boolean(qa?.configured),
            targetAllowlisted: Boolean(qa?.targetAllowlisted),
            override:
              qa && typeof qa.override === 'object' && qa.override !== null
                ? {
                    tier: typeof (qa.override as Record<string, unknown>).tier === 'string' ? ((qa.override as Record<string, unknown>).tier as string) : null,
                    expiresAt:
                      typeof (qa.override as Record<string, unknown>).expiresAt === 'string'
                        ? ((qa.override as Record<string, unknown>).expiresAt as string)
                        : null,
                    revokedAt:
                      typeof (qa.override as Record<string, unknown>).revokedAt === 'string'
                        ? ((qa.override as Record<string, unknown>).revokedAt as string)
                        : null,
                  }
                : null,
            active: Boolean(qa?.active),
            blockedReason: allowedBlocked ? allowedBlocked : null,
          },
        })
      } else {
        setDebug(null)
      }
      if (payload?.trial && typeof payload.trial === 'object') {
        const nextTrial = payload.trial as { active?: unknown; endsAt?: unknown }
        setTrial({
          active: Boolean(nextTrial.active),
          endsAt: typeof nextTrial.endsAt === 'string' ? nextTrial.endsAt : null,
        })
      }
    } catch {
      // Fail-soft: ignore transient fetch errors (offline, navigation aborts, etc).
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Always refresh once on mount so tier (starter/closer) is accurate.
    // This prevents a "Starter" UI from sticking for upgraded accounts where `initialPlan` is 'pro'.
    // The API response is the source of truth for tier labels and upgrade CTAs.
    refresh()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      plan,
      tier,
      planId,
      isHouseCloserOverride,
      isQaTierOverride,
      qaOverride,
      qaDebugEligible,
      debug,
      buildInfo,
      isPro: computeIsPro(plan, tier),
      capabilities,
      trial,
      loading,
      refresh,
    }),
    [plan, tier, planId, isHouseCloserOverride, isQaTierOverride, qaOverride, qaDebugEligible, debug, buildInfo, capabilities, trial, loading, refresh]
  )

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) {
    if (process.env.NODE_ENV !== 'production' && typeof window !== 'undefined') {
      // Soft warning in dev so we notice missing providers, but never crash the app.
      console.warn('[PlanProvider] usePlan called outside of PlanProvider; using starter fallback context.')
    }
    return fallbackPlanValue
  }
  return ctx
}
