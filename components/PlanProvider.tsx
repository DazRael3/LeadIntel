'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

type Plan = 'free' | 'pro'

interface PlanContextValue {
  plan: Plan
  isPro: boolean
  loading: boolean
  refresh: () => Promise<void>
}

const PlanContext = createContext<PlanContextValue | undefined>(undefined)

interface PlanProviderProps {
  initialPlan?: Plan
  children: React.ReactNode
}

export function PlanProvider({ initialPlan = 'free', children }: PlanProviderProps) {
  const [plan, setPlan] = useState<Plan>(initialPlan)
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
      } catch (parseError: any) {
        console.error('PlanProvider: JSON parse error:', parseError, 'Response text:', text.substring(0, 200))
        return
      }
      if (data?.plan === 'pro' || data?.plan === 'free') {
        setPlan(data.plan)
      }
    } catch (error: any) {
      console.error('PlanProvider: Error refreshing plan:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // If initial plan is free, verify once to avoid flicker after checkout.
    if (initialPlan === 'free') {
      refresh()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const value = useMemo(
    () => ({
      plan,
      isPro: plan === 'pro',
      loading,
      refresh,
    }),
    [plan, loading, refresh]
  )

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>
}

export function usePlan() {
  const ctx = useContext(PlanContext)
  if (!ctx) {
    throw new Error('usePlan must be used within a PlanProvider')
  }
  return ctx
}
