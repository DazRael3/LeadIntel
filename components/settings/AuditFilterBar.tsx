'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AuditFilterBar(props: {
  action: string
  actor: string
  from: string
  to: string
  onChange: (next: { action: string; actor: string; from: string; to: string }) => void
  onApply: () => void
}) {
  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
        <Input
          placeholder="action"
          value={props.action}
          onChange={(e) => props.onChange({ action: e.target.value, actor: props.actor, from: props.from, to: props.to })}
          data-testid="audit-filter-action"
        />
        <Input
          placeholder="actor user id"
          value={props.actor}
          onChange={(e) => props.onChange({ action: props.action, actor: e.target.value, from: props.from, to: props.to })}
          data-testid="audit-filter-actor"
        />
        <Input
          placeholder="from (ISO)"
          value={props.from}
          onChange={(e) => props.onChange({ action: props.action, actor: props.actor, from: e.target.value, to: props.to })}
          data-testid="audit-filter-from"
        />
        <Input
          placeholder="to (ISO)"
          value={props.to}
          onChange={(e) => props.onChange({ action: props.action, actor: props.actor, from: props.from, to: e.target.value })}
          data-testid="audit-filter-to"
        />
        <div className="md:col-span-4">
          <Button onClick={props.onApply} className="neon-border hover:glow-effect" data-testid="audit-apply">
            Apply
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

