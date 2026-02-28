'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { BuildInfo } from '@/lib/debug/buildInfo'

type Plan = 'free' | 'pro'
type Tier = 'starter' | 'closer'

export function computeIsPro(plan: Plan, tier: Tier): boolean {
  return plan === 'pro' || tier === 'closer'
}

interface PlanContextValue {
  plan: Plan
  tier: Tier
  planId: string | null
  isHouseCloserOverride: boolean
  buildInfo: BuildInfo | null
  isPro: boolean
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
  buildInfo: null,
  isPro: false,
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
  const [isHouseCloserOverride, setIsHouseCloserOverride] = useState<boolean>(false)
  const [buildInfo] = useState<BuildInfo | null>(initialBuildInfo)
  const [trial, setTrial] = useState<{ active: boolean; endsAt: string | null }>({ active: false, endsAt: null })
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const resp = await fetch('/api/plan', { method: 'GET', cache: 'no-store' })
      if (!resp.ok) return
      const text = await resp.text()
      if (!text || text.trim().length === 0) {
        console.warn('PlanProvider: Empty response from /api/plan')
        return
      }
      let data
      try {
        data = JSON.parse(text)
      } catch (parseError: unknown) {
        console.error('PlanProvider: JSON parse error:', parseError, 'Response text:', text.substring(0, 200))
        return
      }
      // Standard envelope: { ok: true, data: { plan, trial } }
      const payload = data?.data ?? data
      if (payload?.plan === 'pro' || payload?.plan === 'free') {
        setPlan(payload.plan)
      }
      // Product tiers are starter/closer. Treat legacy "team" as "closer" for backward compatibility.
      if (payload?.tier === 'starter' || payload?.tier === 'closer') {
        setTier(payload.tier)
      } else if (payload?.tier === 'team') {
        setTier('closer')
      } else {
        // Safe default: treat unknown/missing as Starter.
        setTier('starter')
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
      if (payload?.trial && typeof payload.trial === 'object') {
        const nextTrial = payload.trial as { active?: unknown; endsAt?: unknown }
        setTrial({
          active: Boolean(nextTrial.active),
          endsAt: typeof nextTrial.endsAt === 'string' ? nextTrial.endsAt : null,
        })
      }
    } catch (error: unknown) {
      console.error('PlanProvider: Error refreshing plan:', error)
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
      buildInfo,
      isPro: computeIsPro(plan, tier),
      trial,
      loading,
      refresh,
    }),
    [plan, tier, planId, isHouseCloserOverride, buildInfo, trial, loading, refresh]
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
