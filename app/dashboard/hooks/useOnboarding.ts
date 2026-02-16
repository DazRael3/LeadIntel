'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatErrorMessage } from '@/lib/utils/format-error'
import { isE2E } from '@/lib/runtimeFlags'

const ONBOARDING_HIDE_SESSION_KEY = 'leadintel_onboarding_hidden' // sessionStorage: "1" means hidden
const ONBOARDING_HIDE_SESSION_FALLBACK_KEY = 'leadintel_onboarding_hide_session' // legacy: "true"
const ONBOARDING_LOCAL_COMPLETED_KEY = 'leadintel_onboarding_completed' // legacy local fallback

interface UseOnboardingReturn {
  showOnboarding: boolean
  onboardingComplete: boolean
  onboardingChecked: boolean
  handleOnboardingComplete: () => void
  dismissOnboarding: () => void
}

/**
 * Hook to manage onboarding state.
 * Handles schema mismatches and missing columns gracefully.
 */
export function useOnboarding(initialOnboardingCompleted: boolean): UseOnboardingReturn {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingComplete, setOnboardingComplete] = useState(initialOnboardingCompleted)
  const [onboardingChecked, setOnboardingChecked] = useState(false)
  const supabase = createClient()

  const markHiddenThisSession = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.sessionStorage.setItem(ONBOARDING_HIDE_SESSION_KEY, '1')
      window.sessionStorage.setItem(ONBOARDING_HIDE_SESSION_FALLBACK_KEY, 'true')
    } catch {
      // ignore
    }
  }, [])

  const markCompletedLocally = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(ONBOARDING_LOCAL_COMPLETED_KEY, 'true')
      window.localStorage.setItem('leadintel:onboarding-completed', 'true') // keep wizard + hook consistent
    } catch {
      // ignore
    }
  }, [])

  const checkOnboarding = useCallback(async () => {
    // Session-scoped "don't flash" flag (prevents open/close flicker during navigation).
    if (typeof window !== 'undefined') {
      try {
        const hidden =
          window.sessionStorage.getItem(ONBOARDING_HIDE_SESSION_KEY) === '1' ||
          window.sessionStorage.getItem(ONBOARDING_HIDE_SESSION_FALLBACK_KEY) === 'true'
        if (hidden) {
          setShowOnboarding(false)
          setOnboardingChecked(true)
          return
        }
      } catch {
        // ignore
      }
    }

    // Don't re-check if already completed (server truth)
    if (onboardingComplete || initialOnboardingCompleted) {
      setOnboardingChecked(true)
      setShowOnboarding(false)
      return
    }
    
    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // No user - don't show onboarding
        setShowOnboarding(false)
        setOnboardingChecked(true)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('user_settings')
        .select('onboarding_completed')
        .eq('user_id', user.id)
        .maybeSingle()
      
      if (fetchError) {
        const errorMsg = formatErrorMessage(fetchError)
        // Check if it's a column-not-found error (schema mismatch)
        if (errorMsg.includes('does not exist') || errorMsg.includes('column')) {
          console.warn('[useOnboarding] Schema mismatch, checking localStorage fallback:', errorMsg)
          // Fall back to localStorage
          const localFlag = typeof window !== 'undefined' && 
            localStorage.getItem(ONBOARDING_LOCAL_COMPLETED_KEY) === 'true'
          setShowOnboarding(!localFlag)
          setOnboardingComplete(localFlag)
        } else {
          // Other error - use localStorage fallback
          console.error('[useOnboarding] Error checking onboarding:', errorMsg)
          const localFlag = typeof window !== 'undefined' && 
            localStorage.getItem(ONBOARDING_LOCAL_COMPLETED_KEY) === 'true'
          setShowOnboarding(!localFlag)
        }
        setOnboardingChecked(true)
        return
      }
        
      // Server truth: if onboarding_completed is true, never show again
      if (data?.onboarding_completed === true) {
        setOnboardingComplete(true)
        setShowOnboarding(false)
        markCompletedLocally()
        markHiddenThisSession()
      } else {
        // Check localStorage for stale flag
        const localFlag = typeof window !== 'undefined' && 
          localStorage.getItem(ONBOARDING_LOCAL_COMPLETED_KEY) === 'true'
        if (!localFlag) {
          setShowOnboarding(true)
        } else {
          // localStorage says completed but server doesn't - trust server, clear localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem(ONBOARDING_LOCAL_COMPLETED_KEY)
          }
          setShowOnboarding(true)
        }
      }
    } catch (err) {
      // On error, check localStorage as fallback
      console.error('[useOnboarding] Error:', formatErrorMessage(err))
      const localFlag = typeof window !== 'undefined' && 
        localStorage.getItem(ONBOARDING_LOCAL_COMPLETED_KEY) === 'true'
      setShowOnboarding(!localFlag)
    } finally {
      setOnboardingChecked(true)
    }
  }, [supabase, onboardingComplete, initialOnboardingCompleted, markCompletedLocally, markHiddenThisSession])

  useEffect(() => {
    // In Playwright/E2E runs, suppress onboarding modals to keep tests deterministic.
    if (isE2E()) {
      setShowOnboarding(false)
      setOnboardingChecked(true)
      return
    }
    // Session-scoped hide flag takes precedence (never render this session).
    if (typeof window !== 'undefined') {
      try {
        const hidden =
          window.sessionStorage.getItem(ONBOARDING_HIDE_SESSION_KEY) === '1' ||
          window.sessionStorage.getItem(ONBOARDING_HIDE_SESSION_FALLBACK_KEY) === 'true'
        if (hidden) {
          setShowOnboarding(false)
          setOnboardingChecked(true)
          return
        }
      } catch {
        // ignore
      }
    }
    // Server truth takes precedence
    if (initialOnboardingCompleted) {
      setShowOnboarding(false)
      setOnboardingComplete(true)
      setOnboardingChecked(true)
      markCompletedLocally()
      markHiddenThisSession()
    } else {
      checkOnboarding()
    }
  }, [initialOnboardingCompleted, checkOnboarding, markCompletedLocally, markHiddenThisSession])

  const handleOnboardingComplete = useCallback(() => {
    // Hide immediately and persist (best-effort).
    setShowOnboarding(false)
    setOnboardingComplete(true)
    setOnboardingChecked(true)
    markCompletedLocally()
    markHiddenThisSession()
    void (async () => {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboarding_completed: true }),
        })
      } catch {
        // best-effort
      }
    })()
  }, [markCompletedLocally, markHiddenThisSession])

  const dismissOnboarding = useCallback(() => {
    // Treat explicit dismiss as completion: persist via API best-effort, and never auto-open again.
    setShowOnboarding(false)
    setOnboardingComplete(true)
    setOnboardingChecked(true)
    markCompletedLocally()
    markHiddenThisSession()
    void (async () => {
      try {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ onboarding_completed: true }),
        })
      } catch {
        // best-effort
      }
    })()
  }, [markCompletedLocally, markHiddenThisSession])

  return {
    showOnboarding,
    onboardingComplete,
    onboardingChecked,
    handleOnboardingComplete,
    dismissOnboarding,
  }
}
