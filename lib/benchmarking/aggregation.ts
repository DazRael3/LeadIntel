import type { BenchmarkBand, BenchmarkRange } from '@/lib/benchmarking/types'

export function clampRatio(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(1, n))
}

export function ratioRangeFromCount(args: { numerator: number; denominator: number; pad: number }): BenchmarkRange {
  const base = args.denominator > 0 ? clampRatio(args.numerator / args.denominator) : 0
  const low = clampRatio(base - args.pad)
  const high = clampRatio(base + args.pad)
  return { low, high, unit: 'ratio' }
}

export function hoursRangeFromAge(args: { hours: number; pad: number }): BenchmarkRange {
  const h = Math.max(0, args.hours)
  return { low: Math.max(0, h - args.pad), high: h + args.pad, unit: 'hours' }
}

export function compareToNorm(args: { current: number; normP25: number; normP75: number; higherIsBetter: boolean }): BenchmarkBand {
  const c = args.current
  const p25 = args.normP25
  const p75 = args.normP75
  if (!Number.isFinite(c) || !Number.isFinite(p25) || !Number.isFinite(p75)) return 'insufficient_evidence'

  if (args.higherIsBetter) {
    if (c < p25) return 'below_norm'
    if (c > p75) return 'above_norm'
    return 'within_norm'
  }

  // Lower is better
  if (c > p75) return 'below_norm'
  if (c < p25) return 'above_norm'
  return 'within_norm'
}

export function confidenceFromEvents(totalEvents: number): 'limited' | 'usable' | 'strong' {
  if (totalEvents >= 800) return 'strong'
  if (totalEvents >= 200) return 'usable'
  return 'limited'
}

