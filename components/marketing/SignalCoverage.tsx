'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'

const ITEMS = [
  'Company changes',
  'Funding and launches',
  'Hiring shifts',
  'Press and partnerships',
  'Watchlist freshness',
  'First-party context when available',
  'Source-backed recency',
] as const

export function SignalCoverage() {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired.current) return
        fired.current = true
        track('proof_section_viewed', { section: 'signal_coverage' })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <Card ref={ref} className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">Signal coverage</CardTitle>
          <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
            Truthful categories only
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {ITEMS.map((x) => (
            <div key={x} className="rounded-lg border border-cyan-500/10 bg-background/40 px-3 py-2">
              {x}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

