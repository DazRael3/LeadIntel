'use client'

import { Badge } from '@/components/ui/badge'

export function CompactReadinessBadge(props: { label: 'ready' | 'blocked' | 'waiting' | 'stale'; detail?: string | null }) {
  const tone =
    props.label === 'ready'
      ? 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
      : props.label === 'blocked'
        ? 'border-red-500/30 text-red-200 bg-red-500/10'
        : props.label === 'waiting'
          ? 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
          : 'border-muted-foreground/20 text-muted-foreground bg-muted/20'

  const text =
    props.label === 'ready' ? 'Ready' : props.label === 'blocked' ? 'Blocked' : props.label === 'waiting' ? 'Waiting' : 'Stale'

  return (
    <Badge variant="outline" className={tone}>
      {text}
      {props.detail ? <span className="ml-1 opacity-80">· {props.detail}</span> : null}
    </Badge>
  )
}

