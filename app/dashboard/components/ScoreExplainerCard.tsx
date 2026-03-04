'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function ScoreExplainerCard() {
  return (
    <Card className="border-cyan-500/20 bg-card/50" data-tour="tour-score-reasons">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Score, explained</CardTitle>
          <Badge variant="outline">Deterministic</Badge>
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-3">
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-foreground">Example</div>
            <Badge variant="outline">82</Badge>
          </div>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Fresh trigger signals (recency).</li>
            <li>ICP match based on your inputs.</li>
            <li>Actionable “why now” context for outreach.</li>
          </ul>
        </div>
        <div className="text-xs">
          <Link className="text-cyan-400 hover:underline" href="/how-scoring-works">
            See how scoring works
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

