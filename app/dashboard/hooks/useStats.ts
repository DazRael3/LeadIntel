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
        .select('*', { count: 'exact', head: true })
      
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
