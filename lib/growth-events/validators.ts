import { z } from 'zod'
import { isGrowthEventName } from '@/lib/growth-events/definitions'
import type { GrowthEventName } from '@/lib/growth-events/types'

export const GrowthEventNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((v) => isGrowthEventName(v), { message: 'Unsupported growth event' }) as z.ZodType<GrowthEventName>

function isJsonPrimitive(x: unknown): x is string | number | boolean | null {
  return x === null || typeof x === 'string' || typeof x === 'number' || typeof x === 'boolean'
}

export function sanitizeGrowthEventProps(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== 'object') return {}
  const obj = input as Record<string, unknown>

  const out: Record<string, unknown> = {}
  const keys = Object.keys(obj).slice(0, 30)
  for (const k of keys) {
    const key = k.trim()
    if (!key || key.length > 64) continue
    const v = obj[k]
    if (isJsonPrimitive(v)) {
      if (typeof v === 'string' && v.length > 300) out[key] = v.slice(0, 300)
      else out[key] = v
      continue
    }
    // Allow shallow arrays of primitives only.
    if (Array.isArray(v)) {
      const arr = v.filter(isJsonPrimitive).slice(0, 20).map((x) => (typeof x === 'string' && x.length > 120 ? x.slice(0, 120) : x))
      out[key] = arr
      continue
    }
    // Drop nested objects by default to avoid accidental payload leakage.
  }
  return out
}

export function normalizeGrowthEventName(name: string): GrowthEventName | null {
  const normalized = name.trim()
  const aliases: Record<string, GrowthEventName> = {
    page_view: 'page_view',
    landing_view: 'page_view',
    landing_viewed: 'page_view',
    demo_started: 'demo_started',
    lead_search_completed: 'results_viewed',
    results_viewed: 'results_viewed',
    signup_completed: 'signup_completed',
    subscription_created: 'payment_completed',
    payment_completed: 'payment_completed',
    checkout_started: 'checkout_started',
    upgrade_clicked: 'checkout_started',
  }
  const mapped = aliases[normalized] ?? null
  if (!mapped) return null
  return isGrowthEventName(mapped) ? mapped : null
}

