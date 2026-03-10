'use client'

import { Badge } from '@/components/ui/badge'
import type { RecommendationConfidenceLabel } from '@/lib/recommendations/types'

export function RecommendationBadge(props: { confidence: RecommendationConfidenceLabel }) {
  const cls =
    props.confidence === 'strong'
      ? 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
      : props.confidence === 'usable'
        ? 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10'
        : 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'

  const label = props.confidence === 'strong' ? 'Strong' : props.confidence === 'usable' ? 'Usable' : 'Limited'

  return (
    <Badge variant="outline" className={cls}>
      {label}
    </Badge>
  )
}

