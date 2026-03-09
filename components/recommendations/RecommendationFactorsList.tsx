'use client'

import { Badge } from '@/components/ui/badge'

export function RecommendationFactorsList(props: {
  factors: Array<{ label: string; value: string; tone: 'positive' | 'caution' | 'neutral' }>
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {props.factors.map((f) => {
        const cls =
          f.tone === 'positive'
            ? 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
            : f.tone === 'caution'
              ? 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
              : 'border-cyan-500/20 text-muted-foreground bg-muted/20'
        return (
          <Badge key={`${f.label}:${f.value}`} variant="outline" className={cls}>
            {f.label}: {f.value}
          </Badge>
        )
      })}
    </div>
  )
}

