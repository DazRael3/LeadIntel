'use client'

import { Badge } from '@/components/ui/badge'

export function WorkspaceContextBadge(props: { name: string; role: string | null }) {
  const role = props.role ? props.role.toString() : null
  return (
    <div className="flex items-center gap-2">
      <Badge variant="outline" className="border-cyan-500/30 bg-cyan-500/10 text-cyan-200">
        {props.name}
      </Badge>
      {role ? (
        <Badge variant="outline" className="border-border/60 bg-background/40 text-muted-foreground">
          {role}
        </Badge>
      ) : null}
    </div>
  )
}

