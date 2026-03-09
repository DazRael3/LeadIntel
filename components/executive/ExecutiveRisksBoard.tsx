'use client'

import { ExecutiveHighlightsBoard } from '@/components/executive/ExecutiveHighlightsBoard'
import type { ExecutiveHighlight } from '@/lib/executive/types'

export function ExecutiveRisksBoard(props: { items: ExecutiveHighlight[] }) {
  return <ExecutiveHighlightsBoard title="Risks and blockers" items={props.items} />
}

