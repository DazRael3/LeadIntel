'use client'

import { useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'

export function UsageMeter(props: {
  used: number
  limit: number
  label?: string
  helper?: string
  lockedHelper?: string
  scopeHelper?: string
  eventContext?: { surface: string }
}) {
  const used = Math.max(0, Math.min(props.used, props.limit))
  const pct = props.limit > 0 ? Math.round((used / props.limit) * 100) : 0

  useEffect(() => {
    if (!props.eventContext) return
    track('free_generation_meter_viewed', { ...props.eventContext, used: props.used, limit: props.limit })
    track('generation_limit_meter_viewed', { ...props.eventContext, used: props.used, limit: props.limit })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-foreground">{props.label ?? 'Free generation limit'}</div>
          <Badge variant={used >= props.limit ? 'destructive' : 'secondary'}>
            {used} of {props.limit} used
          </Badge>
        </div>
        <div className="mt-3 h-2 w-full rounded-full bg-muted">
          <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>{used >= props.limit ? 'You’ve used all preview generations. Upgrade to continue.' : props.helper ?? 'Generate up to 3 pitch/report previews on Free.'}</div>
          {props.scopeHelper ? (
            <div
              onMouseEnter={() => {
                if (!props.eventContext) return
                track('free_generation_scope_help_viewed', { ...props.eventContext })
              }}
            >
              {props.scopeHelper}
            </div>
          ) : null}
          {props.lockedHelper ? <div>{props.lockedHelper}</div> : null}
        </div>
      </CardContent>
    </Card>
  )
}

