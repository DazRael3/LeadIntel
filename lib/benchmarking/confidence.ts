import type { BenchmarkConfidenceLabel } from '@/lib/benchmarking/types'

export function benchmarkConfidenceFromEvents(totalEvents: number): BenchmarkConfidenceLabel {
  if (totalEvents >= 800) return 'strong'
  if (totalEvents >= 200) return 'usable'
  return 'limited'
}

