'use client'

import { useCallback, useEffect, useState } from 'react'

type ActivationV2Envelope =
  | {
      ok: true
      data: {
        activation: {
          completedCount: number
          totalCount: number
          completed: boolean
          nextBestStep: string | null
          steps: Array<{ id: string; title: string; description: string; completed: boolean; meta?: Record<string, unknown> }>
          counts: { targets: number; pitches: number; reports: number; briefs: number }
          viewed: { pricing: boolean; trust: boolean; scoring: boolean; templates: boolean }
        }
        usage: { used: number; limit: number; remaining: number }
        capabilities: { tier: string; freeGenerationLabel: string | null; freeGenerationHelper: string | null; freeUsageScopeLabel: string | null; lockedHelper: string | null }
      }
    }
  | { ok: false; error?: { message?: string } }

export function useActivationV2() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ActivationV2Envelope | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/activation-v2', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as ActivationV2Envelope | null
      setData(json)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const model = data && data.ok === true ? data.data : null

  return { loading, data, model, refresh }
}

