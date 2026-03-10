'use client'

import { EmbedFrame } from '@/components/embed/EmbedFrame'
import { Badge } from '@/components/ui/badge'

export function EmbedErrorState(props: { title: string; detail?: string | null }) {
  return (
    <EmbedFrame title={props.title} subtitle="Embed access">
      <div className="space-y-2 text-sm text-muted-foreground">
        <Badge variant="outline">Unavailable</Badge>
        <div>{props.detail ?? 'This embed is invalid or expired.'}</div>
      </div>
    </EmbedFrame>
  )
}

