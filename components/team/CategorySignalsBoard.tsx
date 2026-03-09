'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

type Insight = {
  playbookSlug: string
  label: string
  summary: string
  confidence: string
  limitationsNote: string | null
}

function isInsight(x: unknown): x is Insight {
  return Boolean(x && typeof x === 'object' && 'playbookSlug' in x && 'label' in x && 'summary' in x)
}

export function CategorySignalsBoard(props: { insights: unknown[] }) {
  const insights = (props.insights ?? []).filter(isInsight)
  if (insights.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Category signal intelligence (workspace-only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((i) => (
          <div key={i.playbookSlug} className="rounded border border-border/60 bg-background/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium text-foreground">{i.label}</div>
                <div className="text-xs text-muted-foreground">{i.playbookSlug}</div>
              </div>
              <Badge variant="outline">{i.confidence}</Badge>
            </div>
            <div className="mt-2 text-sm text-foreground">{i.summary}</div>
            {i.limitationsNote ? <div className="mt-1 text-xs text-muted-foreground">{i.limitationsNote}</div> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

