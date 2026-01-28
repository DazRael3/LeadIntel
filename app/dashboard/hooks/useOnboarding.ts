'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatErrorMessage } from '@/lib/utils/format-error'

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

  const checkOnboarding = useCallback(async () => {
    // Session-scoped "don't flash" flag (prevents open/close flicker during navigation).
    if (typeof window !== 'undefined') {
      try {
        if (window.sessionStorage.getItem('leadintel_onboarding_hide_session') === 'true') {
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
            localStorage.getItem('leadintel_onboarding_completed') === 'true'
          setShowOnboarding(!localFlag)
          setOnboardingComplete(localFlag)
        } else {
          // Other error - use localStorage fallback
          console.error('[useOnboarding] Error checking onboarding:', errorMsg)
          const localFlag = typeof window !== 'undefined' && 
            localStorage.getItem('leadintel_onboarding_completed') === 'true'
          setShowOnboarding(!localFlag)
        }
        setOnboardingChecked(true)
        return
      }
        
      // Server truth: if onboarding_completed is true, never show again
      if (data?.onboarding_completed === true) {
        setOnboardingComplete(true)
        setShowOnboarding(false)
        if (typeof window !== 'undefined') {
          localStorage.setItem('leadintel_onboarding_completed', 'true')
          try {
            window.sessionStorage.setItem('leadintel_onboarding_hide_session', 'true')
          } catch {
            // ignore
          }
        }
      } else {
        // Check localStorage for stale flag
        const localFlag = typeof window !== 'undefined' && 
          localStorage.getItem('leadintel_onboarding_completed') === 'true'
        if (!localFlag) {
          setShowOnboarding(true)
        } else {
          // localStorage says completed but server doesn't - trust server, clear localStorage
          if (typeof window !== 'undefined') {
            localStorage.removeItem('leadintel_onboarding_completed')
          }
          setShowOnboarding(true)
        }
      }
    } catch (err) {
      // On error, check localStorage as fallback
      console.error('[useOnboarding] Error:', formatErrorMessage(err))
      const localFlag = typeof window !== 'undefined' && 
        localStorage.getItem('leadintel_onboarding_completed') === 'true'
      setShowOnboarding(!localFlag)
    } finally {
      setOnboardingChecked(true)
    }
  }, [supabase, onboardingComplete, initialOnboardingCompleted])

  useEffect(() => {
    // Server truth takes precedence
    if (initialOnboardingCompleted) {
      setShowOnboarding(false)
      setOnboardingComplete(true)
      setOnboardingChecked(true)
      if (typeof window !== 'undefined') {
        localStorage.setItem('leadintel_onboarding_completed', 'true')
        try {
          window.sessionStorage.setItem('leadintel_onboarding_hide_session', 'true')
        } catch {
          // ignore
        }
      }
    } else {
      checkOnboarding()
    }
  }, [initialOnboardingCompleted, checkOnboarding])

  const handleOnboardingComplete = useCallback(() => {
    setShowOnboarding(false)
    setOnboardingComplete(true)
    setOnboardingChecked(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('leadintel_onboarding_completed', 'true')
      try {
        window.sessionStorage.setItem('leadintel_onboarding_hide_session', 'true')
      } catch {
        // ignore
      }
    }
  }, [])

  const dismissOnboarding = useCallback(() => {
    // Treat explicit dismiss as completion: persist via API best-effort, and never auto-open again.
    setShowOnboarding(false)
    setOnboardingComplete(true)
    setOnboardingChecked(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('leadintel_onboarding_completed', 'true')
      try {
        window.sessionStorage.setItem('leadintel_onboarding_hide_session', 'true')
      } catch {
        // ignore
      }
    }
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
  }, [])

  return {
    showOnboarding,
    onboardingComplete,
    onboardingChecked,
    handleOnboardingComplete,
    dismissOnboarding,
  }
}
