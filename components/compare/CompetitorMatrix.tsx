'use client'

import { useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'
import { CompetitorScoreCard, type CompetitorScore } from './CompetitorScoreCard'

export function CompetitorMatrix(props: { entries: CompetitorScore[] }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  const payload = useMemo(
    () => ({
      order: props.entries.map((e) => e.name),
      scores: props.entries.map((e) => e.score),
    }),
    [props.entries]
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired.current) return
        fired.current = true
        track('competitor_matrix_viewed', payload)
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [payload])

  return (
    <div ref={ref} className="grid grid-cols-1 gap-4">
      <Card className="border-cyan-500/20 bg-card/60">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-lg">Competitor matrix (public pressure)</CardTitle>
            <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
              Signal-based outbound category
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <div>
            These scores represent public-site competitive pressure in the category LeadIntel is pursuing: signal-based outbound, why-now intelligence, and
            send-ready outreach.
          </div>
          <div>Scores reflect current public positioning, workflow depth, proof, trust, and actionability in LeadIntel’s competitive set.</div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4">
        {props.entries.map((item, idx) => (
          <CompetitorScoreCard key={item.key} rank={idx + 1} item={item} />
        ))}
      </div>
    </div>
  )
}

