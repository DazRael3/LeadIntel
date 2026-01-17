'use client'

import { useState, useCallback } from 'react'

interface DebugInfo {
  [key: string]: unknown
  error?: string
  details?: string
}

interface UseDebugInfoReturn {
  debugInfo: DebugInfo | null
  showDebug: boolean
  checkWhoami: () => Promise<void>
  hideDebug: () => void
}

export function useDebugInfo(): UseDebugInfoReturn {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [showDebug, setShowDebug] = useState(false)

  const checkWhoami = useCallback(async () => {
    try {
      const response = await fetch('/api/whoami')
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      const text = await response.text()
      if (!text || text.trim().length === 0) {
        throw new Error('Empty response from /api/whoami')
      }
      let data: DebugInfo
      try {
        data = JSON.parse(text) as DebugInfo
      } catch (parseError) {
        const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error'
        console.error('JSON parse error in checkWhoami:', parseError, 'Response text:', text.substring(0, 200))
        throw new Error(`Invalid JSON: ${errorMessage}`)
      }
      setDebugInfo(data)
      setShowDebug(true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error('checkWhoami error:', err)
      setDebugInfo({ error: 'Failed to fetch debug info', details: errorMessage })
      setShowDebug(true)
    }
  }, [])

  const hideDebug = useCallback(() => {
    setShowDebug(false)
  }, [])

  return { debugInfo, showDebug, checkWhoami, hideDebug }
}
