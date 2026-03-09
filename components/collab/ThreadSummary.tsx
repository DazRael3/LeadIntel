import { Badge } from '@/components/ui/badge'

export function ThreadSummary(props: { openCount: number; resolvedCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline">{props.openCount} open</Badge>
      <Badge variant="outline">{props.resolvedCount} resolved</Badge>
    </div>
  )
}

