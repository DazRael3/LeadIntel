'use client'

import { WorkflowBenchmarkCard } from '@/components/team/WorkflowBenchmarkCard'
import type { WorkflowBenchmarkMetric } from '@/lib/benchmarking/types'

function isWorkflowMetric(x: unknown): x is WorkflowBenchmarkMetric {
  return Boolean(x && typeof x === 'object' && 'area' in x && 'summary' in x && 'current' in x)
}

export function BenchmarkSummaryBoard(props: { loading: boolean; metrics: unknown[] }) {
  if (props.loading) {
    return <div className="text-sm text-muted-foreground">Loading benchmarks…</div>
  }

  const metrics = props.metrics.filter(isWorkflowMetric)
  if (metrics.length === 0) {
    return <div className="text-sm text-muted-foreground">No benchmark data available yet.</div>
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {metrics.map((m) => (
        <WorkflowBenchmarkCard key={`${m.area}:${m.computedAt}`} metric={m} />
      ))}
    </div>
  )
}

