'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatErrorMessage } from '@/lib/utils/format-error'
import type { TriggerEvent } from '@/lib/supabaseClient'

interface UseTriggerEventsReturn {
  events: TriggerEvent[]
  loading: boolean
  error: string | null
  loadEvents: () => Promise<void>
}

type TriggerEventRow = {
  id: string
  company_name?: string | null
  company_domain?: string | null
  company_url?: string | null
  event_type?: string | null
  event_description?: string | null
  headline?: string | null
  source_url?: string | null
  detected_at?: string | null
  created_at?: string | null
}

/**
 * Hook to load trigger events for the current user.
 * Handles schema mismatches and missing columns gracefully.
 */
export function useTriggerEvents(): UseTriggerEventsReturn {
  const [events, setEvents] = useState<TriggerEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const loadEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        // Not authenticated is a valid state, not an error
        setEvents([])
        setLoading(false)
        return
      }

      // Query with explicit column selection to handle schema variations
      // If columns don't exist, Supabase returns 400 - we catch and handle gracefully
      const { data, error: fetchError } = await supabase
        .from('trigger_events')
        .select('id, user_id, company_name, company_domain, company_url, event_type, event_description, headline, source_url, detected_at, created_at')
        .eq('user_id', user.id)
        .order('detected_at', { ascending: false })
        .limit(25)

      if (fetchError) {
        // Check if it's a column-not-found error (schema mismatch)
        const errorMsg = formatErrorMessage(fetchError)
        if (errorMsg.includes('does not exist') || errorMsg.includes('column')) {
          // Schema mismatch - return empty array, log warning
          console.warn('[useTriggerEvents] Schema mismatch, returning empty events:', errorMsg)
          setEvents([])
          setError(null) // Don't show error to user for schema issues
        } else {
          setError(errorMsg)
          setEvents([])
        }
        return
      }
      
      // Normalize data to match TriggerEvent interface with safe defaults
      const rows = (data ?? []) as TriggerEventRow[]
      const normalizedEvents: TriggerEvent[] = rows.map((row) => ({
        id: row.id,
        company_name: row.company_name || 'Unknown Company',
        event_type: row.event_type || 'expansion',
        event_description: row.event_description || '',
        source_url: row.source_url || '',
        detected_at: row.detected_at || row.created_at || new Date().toISOString(),
        company_url: row.company_url,
        company_domain: row.company_domain,
        headline: row.headline,
        created_at: row.created_at || new Date().toISOString(),
      }))
      
      setEvents(normalizedEvents)
      setError(null)
    } catch (err) {
      // Catch-all for unexpected errors
      const errorMessage = formatErrorMessage(err)
      console.error('[useTriggerEvents] Error loading events:', errorMessage)
      setError(errorMessage)
      setEvents([]) // Safe fallback
    } finally {
      setLoading(false)
    }
  }, [supabase])

  return { events, loading, error, loadEvents }
}
