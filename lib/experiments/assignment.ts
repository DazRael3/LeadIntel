import crypto from 'crypto'
import type { ExperimentVariant } from '@/lib/experiments/types'

function clampInt(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

export function stableBucket(args: { seed: string; key: string; unitId: string }): number {
  const h = crypto.createHash('sha256').update(args.seed).update('|').update(args.key).update('|').update(args.unitId).digest()
  // Use first 4 bytes as unsigned int -> [0, 2^32)
  const n = h.readUInt32BE(0)
  // Map to [0, 9999] for stable rollout/weights.
  return n % 10000
}

export function inRollout(args: { bucket: number; rolloutPercent: number }): boolean {
  const pct = clampInt(args.rolloutPercent, 0, 100)
  if (pct <= 0) return false
  if (pct >= 100) return true
  // bucket ∈ [0,9999] => pct% corresponds to pct*100 buckets
  return args.bucket < pct * 100
}

export function pickVariant(args: { bucket: number; variants: ExperimentVariant[] }): string | null {
  if (args.variants.length === 0) return null
  const normalized = args.variants
    .map((v) => ({ ...v, weight: clampInt(v.weight, 0, 10000) }))
    .filter((v) => v.key.trim().length > 0 && v.weight > 0)

  const total = normalized.reduce((acc, v) => acc + v.weight, 0)
  if (total <= 0) return null

  const r = args.bucket % total
  let cursor = 0
  for (const v of normalized) {
    cursor += v.weight
    if (r < cursor) return v.key
  }
  return normalized[normalized.length - 1]?.key ?? null
}

