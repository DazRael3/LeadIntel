'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export type CompetitorScore = {
  key: 'usergems' | 'common_room' | 'zoominfo_copilot' | 'apollo' | 'leadintel'
  name: string
  score: number
  threatSummary: string
  leadIntelWins: string
  theyDoBetter: string
  compareHref?: string
}

export function CompetitorScoreCard(props: { rank: number; item: CompetitorScore }) {
  const scoreLabel = props.item.score.toFixed(1)
  const isLeadIntel = props.item.key === 'leadintel'

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="text-base">
            <span className="text-muted-foreground mr-2">#{props.rank}</span>
            {props.item.name}
          </CardTitle>
          <Badge
            variant="outline"
            className={isLeadIntel ? 'border-purple-500/30 bg-purple-500/10 text-purple-300' : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'}
          >
            {scoreLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">{props.item.threatSummary}</div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">LeadIntel wins</div>
            <div className="mt-1 text-sm text-foreground">{props.item.leadIntelWins}</div>
          </div>
          <div className="rounded-lg border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">They do better</div>
            <div className="mt-1 text-sm text-foreground">{props.item.theyDoBetter}</div>
          </div>
        </div>

        {props.item.compareHref ? (
          <div className="flex flex-wrap gap-3 text-xs">
            <Link className="text-cyan-400 hover:underline" href={props.item.compareHref}>
              View comparison
            </Link>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

