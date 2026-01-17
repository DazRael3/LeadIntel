'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatErrorMessage } from '@/lib/utils/format-error'

export const FREE_DAILY_CREDITS = 1

interface UseCreditsReturn {
  creditsRemaining: number
  loading: boolean
  error: string | null
  loadCredits: (isPro: boolean) => Promise<void>
}

/**
 * Hook to manage user credits.
 * Handles schema mismatches and missing columns gracefully.
 */
export function useCredits(initialCredits: number, initialIsPro: boolean): UseCreditsReturn {
  const [creditsRemaining, setCreditsRemaining] = useState(initialCredits)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadCredits = useCallback(async (isPro: boolean) => {
    setError(null)
    
    // Pro users have unlimited credits
    if (isPro) {
      setCreditsRemaining(9999)
      setLoading(false)
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // Not authenticated - use default credits
        setCreditsRemaining(FREE_DAILY_CREDITS)
        setLoading(false)
        return
      }

      // Query with explicit columns - handle missing columns gracefully
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('credits_remaining, last_credit_reset')
        .eq('id', user.id)
        .maybeSingle() // Use maybeSingle to avoid error if no row exists

      if (fetchError) {
        const errorMsg = formatErrorMessage(fetchError)
        // Check if it's a column-not-found error (schema mismatch)
        if (errorMsg.includes('does not exist') || errorMsg.includes('column')) {
          console.warn('[useCredits] Schema mismatch, using default credits:', errorMsg)
          setCreditsRemaining(FREE_DAILY_CREDITS)
          setError(null) // Don't show error to user for schema issues
        } else {
          console.error('[useCredits] Error loading credits:', errorMsg)
          setError(errorMsg)
          setCreditsRemaining(FREE_DAILY_CREDITS) // Safe fallback
        }
        setLoading(false)
        return
      }
      
      // Handle null data (user row doesn't exist or columns are null)
      if (!data || data.credits_remaining === null || data.credits_remaining === undefined) {
        setCreditsRemaining(FREE_DAILY_CREDITS)
        setLoading(false)
        return
      }

      const today = new Date().toDateString()
      const lastReset = data.last_credit_reset 
        ? new Date(data.last_credit_reset).toDateString()
        : null
      
      // Reset credits if it's a new day
      if (lastReset !== today) {
        // Try to update, but don't fail if columns don't exist
        try {
          await supabase
            .from('users')
            .update({
              credits_remaining: FREE_DAILY_CREDITS,
              last_credit_reset: new Date().toISOString()
            })
            .eq('id', user.id)
        } catch (updateErr) {
          // Update failed, but continue with fresh credits
          console.warn('[useCredits] Failed to reset credits in DB:', formatErrorMessage(updateErr))
        }
        setCreditsRemaining(FREE_DAILY_CREDITS)
      } else {
        setCreditsRemaining(data.credits_remaining ?? FREE_DAILY_CREDITS)
      }
      
      setError(null)
    } catch (err) {
      const errorMessage = formatErrorMessage(err)
      console.error('[useCredits] Error loading credits:', errorMessage)
      setError(errorMessage)
      setCreditsRemaining(FREE_DAILY_CREDITS) // Safe fallback
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return { creditsRemaining, loading, error, loadCredits }
}
