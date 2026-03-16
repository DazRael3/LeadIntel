'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DemoLoop } from '@/components/landing/DemoLoop'

export function OneMinuteDemo() {
  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">1-minute demo</CardTitle>
        <p className="text-xs text-muted-foreground">Enter ICP → see digest → generate pitch.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded border border-cyan-500/20 bg-background/50 p-4">
          <DemoLoop />
        </div>
      </CardContent>
    </Card>
  )
}

