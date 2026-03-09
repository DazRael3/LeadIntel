'use client'

import { Card, CardContent } from '@/components/ui/card'

export function ExecutiveMethodNote(props: { note: string }) {
  return (
    <Card className="border-cyan-500/20 bg-card/40">
      <CardContent className="pt-4 text-xs text-muted-foreground">
        <span className="text-foreground font-medium">Method note:</span> {props.note}
      </CardContent>
    </Card>
  )
}

