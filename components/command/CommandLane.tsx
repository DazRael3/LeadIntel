'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { CommandLaneItem, CommandLaneKey } from '@/lib/services/command-center'

function tone(key: CommandLaneKey): string {
  if (key === 'act_now') return 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
  if (key === 'blocked') return 'border-red-500/30 text-red-200 bg-red-500/10'
  if (key === 'review_needed') return 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
  return 'border-cyan-500/20 text-muted-foreground bg-muted/20'
}

export function CommandLane(props: { title: string; lane: CommandLaneKey; items: CommandLaneItem[]; onOpenItem: (item: CommandLaneItem) => void }) {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{props.title}</CardTitle>
          <Badge variant="outline" className={tone(props.lane)}>
            {props.items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        {props.items.length === 0 ? (
          <div className="text-xs text-muted-foreground">Nothing here right now.</div>
        ) : (
          props.items.map((i) => (
            <button
              key={i.id}
              className="w-full text-left rounded border border-cyan-500/10 bg-background/40 p-3 hover:bg-cyan-500/5"
              onClick={() => props.onOpenItem(i)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="text-foreground font-medium">{i.title}</div>
                <Badge variant="outline" className={tone(props.lane)}>
                  {i.kind === 'approval' ? 'approval' : 'queue'}
                </Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{i.subtitle}</div>
            </button>
          ))
        )}
      </CardContent>
    </Card>
  )
}

