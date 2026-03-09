'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { RecommendationFactorsList } from '@/components/recommendations/RecommendationFactorsList'
import { RecommendationLimitations } from '@/components/recommendations/RecommendationLimitations'
import type { RecommendationBundle } from '@/lib/recommendations/types'
import { track } from '@/lib/analytics'

export function WhyRecommendedDrawer(props: { bundle: RecommendationBundle }) {
  const [open, setOpen] = useState(false)

  const factors = useMemo(() => {
    const first = props.bundle.recommendations[0]
    return first?.supportingFactors ?? []
  }, [props.bundle.recommendations])

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next) track('why_recommended_opened', { targetId: props.bundle.targetId, version: props.bundle.recommendations[0]?.version })
        }}
      >
        {open ? 'Hide why' : 'Why recommended'}
      </Button>

      {open ? (
        <div className="mt-3">
          <Card className="border-cyan-500/20 bg-card/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Why you’re seeing this</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="text-foreground font-medium">{props.bundle.summary.whyNow}</div>
              <RecommendationFactorsList factors={factors} />
              <RecommendationLimitations note={props.bundle.summary.limitationsNote} />
              <div className="text-xs text-muted-foreground">
                Confidence is a band (limited/usable/strong) derived from source coverage and freshness—not a promised win-rate.
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}

