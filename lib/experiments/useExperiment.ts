'use client'

import { useEffect, useMemo, useState } from 'react'
import { track } from '@/lib/analytics'
import type { ExperimentAssignment } from '@/lib/experiments/types'

type Envelope =
  | { ok: true; data: { workspaceId: string; assignment: ExperimentAssignment } }
  | { ok: false; error?: { message?: string } }

export function useExperiment(args: { experimentKey: string; surface: string; trackSeenEvent?: string }): {
  assignment: ExperimentAssignment | null
  loading: boolean
} {
  const [assignment, setAssignment] = useState<ExperimentAssignment | null>(null)
  const [loading, setLoading] = useState(true)

  const enabled = (process.env.NEXT_PUBLIC_EXPERIMENTS_ENABLED ?? '').trim().toLowerCase()
  const isEnabled = enabled === '1' || enabled === 'true'

  const payload = useMemo(() => ({ experimentKey: args.experimentKey, surface: args.surface }), [args.experimentKey, args.surface])

  useEffect(() => {
    let cancelled = false
    if (!isEnabled) {
      setAssignment(null)
      setLoading(false)
      return () => {
        cancelled = true
      }
    }

    setLoading(true)
    void (async () => {
      try {
        const res = await fetch('/api/experiments/expose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          credentials: 'include',
        })
        const json = (await res.json().catch(() => null)) as Envelope | null
        if (cancelled) return
        if (json && json.ok === true) {
          setAssignment(json.data.assignment)
          if (args.trackSeenEvent) {
            track(args.trackSeenEvent, {
              experimentKey: json.data.assignment.experimentKey,
              variantKey: json.data.assignment.variantKey,
              surface: args.surface,
            })
          }
          return
        }
        setAssignment(null)
      } catch {
        if (!cancelled) setAssignment(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [payload, args.surface, args.trackSeenEvent, isEnabled])

  return { assignment, loading }
}

