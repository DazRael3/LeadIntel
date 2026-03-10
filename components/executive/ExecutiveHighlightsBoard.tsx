'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ExecutiveHighlight } from '@/lib/executive/types'

function tone(kind: ExecutiveHighlight['kind']): string {
  if (kind === 'positive') return 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
  if (kind === 'risk') return 'border-red-500/30 text-red-200 bg-red-500/10'
  return 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10'
}

export function ExecutiveHighlightsBoard(props: { items: ExecutiveHighlight[]; title: string }) {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{props.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {props.items.length === 0 ? (
          <div className="text-xs text-muted-foreground">No highlights yet.</div>
        ) : (
          props.items.slice(0, 8).map((h, idx) => (
            <div key={`${h.title}:${idx}`} className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-foreground font-medium">{h.title}</div>
                <Badge variant="outline" className={tone(h.kind)}>
                  {h.kind}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{h.detail}</div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

