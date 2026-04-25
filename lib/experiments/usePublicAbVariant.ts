'use client'

import { useEffect, useMemo, useState } from 'react'
import { track } from '@/lib/analytics'

type PublicAbVariantArgs = {
  key: string
  variants: readonly string[]
  surface?: string
  fallback?: string
}

const VISITOR_ID_KEY = 'li_public_ab_visitor_id'

function getVisitorId(): string {
  if (typeof window === 'undefined') return 'server'
  const existing = window.localStorage.getItem(VISITOR_ID_KEY)
  if (existing && existing.trim().length > 0) return existing
  const next =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  window.localStorage.setItem(VISITOR_ID_KEY, next)
  return next
}

function stableBucket(seed: string): number {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
  }
  return Math.abs(hash >>> 0)
}

function keyForExperiment(experimentKey: string): string {
  return `li_public_ab_variant:${experimentKey}`
}

function resolveVariant(args: {
  experimentKey: string
  variants: readonly string[]
  fallbackVariant: string
}): string {
  if (typeof window === 'undefined') return args.fallbackVariant
  const key = keyForExperiment(args.experimentKey)
  const existing = window.localStorage.getItem(key)
  if (existing && args.variants.includes(existing)) return existing

  const visitorId = getVisitorId()
  const bucket = stableBucket(`${visitorId}:${args.experimentKey}`)
  const idx = bucket % args.variants.length
  const variant = args.variants[idx] ?? args.fallbackVariant
  window.localStorage.setItem(key, variant)
  return variant
}

export function usePublicAbVariant(args: PublicAbVariantArgs): { variant: string } {
  const variantList = useMemo(() => [...args.variants], [args.variants])
  const fallbackVariant = args.fallback ?? variantList[0] ?? 'control'
  const [variant, setVariant] = useState<string>(fallbackVariant)
  const surface = args.surface ?? 'public'

  useEffect(() => {
    if (variantList.length === 0) {
      setVariant(fallbackVariant)
      return
    }
    setVariant(
      resolveVariant({
        experimentKey: args.key,
        variants: variantList,
        fallbackVariant,
      })
    )
  }, [args.key, fallbackVariant, variantList])

  useEffect(() => {
    if (!variant) return
    track('experiment_exposed', {
      source: 'public_ab',
      surface,
      experimentKey: args.key,
      variantKey: variant,
      dedupeKey: `public_ab:${args.key}:${variant}`,
    })
  }, [args.key, surface, variant])

  return { variant }
}
