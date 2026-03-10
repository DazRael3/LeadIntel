'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'
import type { CommandLaneItem } from '@/lib/services/command-center'
import { track } from '@/lib/analytics'

export function WhyThisNeedsAttentionDrawer(props: { open: boolean; item: CommandLaneItem | null; onClose: () => void }) {
  if (!props.open || !props.item) return null
  const i = props.item
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={props.onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl p-4">
        <Card className="h-full border-cyan-500/20 bg-background/95 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">Why this needs attention</CardTitle>
                <div className="mt-1 text-xs text-muted-foreground">{i.title}</div>
              </div>
              <Button size="sm" variant="outline" onClick={props.onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded border border-cyan-500/10 bg-card/30 p-3">
              <div className="text-foreground font-medium">{i.subtitle}</div>
              <div className="mt-2 text-xs text-muted-foreground">
                This item is highlighted because it is in the <span className="text-foreground font-medium">{i.lane.replace('_', ' ')}</span> lane.
              </div>
            </div>
            <div className="rounded border border-cyan-500/10 bg-card/30 p-3 text-xs text-muted-foreground">
              <span className="text-foreground font-medium">Observed vs inferred:</span> Lanes are derived from observed statuses (queue + approvals). No real-time
              inference is implied.
            </div>
            <div className="flex justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  track('why_this_needs_attention_opened', { id: i.id, kind: i.kind, lane: i.lane })
                  props.onClose()
                }}
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

