'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { PersonaRecommendationSummary } from '@/lib/domain/people'
import { PersonaAngleCard } from '@/components/account/PersonaAngleCard'
import { track } from '@/lib/analytics'
import { useEffect } from 'react'

function confidenceLabel(c: PersonaRecommendationSummary['confidence']): string {
  if (c === 'strong') return 'Strong basis'
  if (c === 'usable') return 'Usable basis'
  return 'Limited basis'
}

export function RecommendedPeopleCard(props: { accountId: string; personas: PersonaRecommendationSummary }) {
  useEffect(() => {
    track('persona_recommendations_viewed', { accountId: props.accountId })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per mount in modal context
  }, [])

  const p = props.personas

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Recommended people (buying-group)</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{confidenceLabel(p.confidence)}</Badge>
            {p.champion ? <Badge variant="outline">Champion: {p.champion}</Badge> : null}
            {p.economicBuyer ? <Badge variant="outline">EB: {p.economicBuyer}</Badge> : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div className="text-xs text-muted-foreground">
          These are heuristic, signal-based persona recommendations. LeadIntel won’t fabricate named contacts.
        </div>

        <div className="flex flex-wrap gap-2">
          {p.topPersonas.map((role) => (
            <Badge key={role} variant="outline">
              {role}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {p.items.slice(0, 4).map((angle) => (
            <PersonaAngleCard key={`${angle.persona}-${angle.priority}`} accountId={props.accountId} angle={angle} />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

