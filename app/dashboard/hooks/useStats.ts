'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatErrorMessage } from '@/lib/utils/format-error'

interface UseStatsReturn {
  totalLeads: number
  loadStats: () => Promise<void>
}

export function useStats(): UseStatsReturn {
  const [totalLeads, setTotalLeads] = useState(0)
  const supabase = createClient()

  const loadStats = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('leads')
        // Avoid HEAD requests (they show up as requestfailed/aborted during rapid navigations).
        // Keep payload minimal while still reading the count deterministically.
        .select('id', { count: 'exact' })
        .limit(1)
      
      if (error) {
        throw error
      }
      
      setTotalLeads(count || 0)
    } catch (err) {
      const errorMessage = formatErrorMessage(err)
      console.error('Error loading stats:', errorMessage)
      setTotalLeads(0) // Safe fallback
    }
  }, [supabase])

  return { totalLeads, loadStats }
}
