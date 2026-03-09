'use client'

import { useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { track } from '@/lib/analytics'
import { CapabilityProofGrid } from '@/components/marketing/CapabilityProofGrid'

export function ProofLayer() {
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
        track('proof_section_viewed', { section: 'why_leadintel_feels_different' })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref} className="space-y-4">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Why LeadIntel feels different in practice</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Proof that maps to real mechanics: explainable scoring, momentum over time, persona recommendations, first-party context when observed, and an action layer built for rep execution—not a giant contact database.
        </CardContent>
      </Card>
      <CapabilityProofGrid />
    </div>
  )
}

