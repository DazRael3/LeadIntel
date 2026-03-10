'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function EmbedFrame(props: { title: string; subtitle?: string | null; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background terminal-grid p-4">
      <Card className="border-cyan-500/20 bg-card/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{props.title}</CardTitle>
          {props.subtitle ? <div className="text-xs text-muted-foreground">{props.subtitle}</div> : null}
        </CardHeader>
        <CardContent>{props.children}</CardContent>
      </Card>
    </div>
  )
}

