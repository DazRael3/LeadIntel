import { Ratelimit, type Duration } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextRequest } from 'next/server'
import { getClientIp } from '@/lib/api/ratelimit'

type RateLimitDecision = {
  ok: boolean
  remaining: number
  reset: number
}

const globalStoreKey = '__leadintelPublicRateLimitStore'
type Entry = { count: number; resetAtSec: number }

function getMemoryStore(): Map<string, Entry> {
  const g = globalThis as unknown as Record<string, unknown>
  const existing = g[globalStoreKey]
  if (existing instanceof Map) return existing as Map<string, Entry>
  const next = new Map<string, Entry>()
  g[globalStoreKey] = next
  return next
}

function getUpstashConfig(): { url: string; token: string } | null {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? '').trim()
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? '').trim()
  if (!/^https?:\/\//.test(url) || token.length === 0) return null
  return { url, token }
}

async function checkMemoryLimit(args: {
  key: string
  limit: number
  windowMs: number
}): Promise<RateLimitDecision> {
  // Fallback is dev-safe and works in a single Node process.
  // NOTE: In serverless/multi-instance environments, memory is not shared across instances.
  const store = getMemoryStore()
  const nowSec = Math.floor(Date.now() / 1000)
  const windowSec = Math.max(1, Math.floor(args.windowMs / 1000))

  const existing = store.get(args.key)
  const entry: Entry =
    !existing || existing.resetAtSec <= nowSec
      ? { count: 0, resetAtSec: nowSec + windowSec }
      : existing

  entry.count += 1
  store.set(args.key, entry)

  const ok = entry.count <= args.limit
  return {
    ok,
    remaining: Math.max(0, args.limit - entry.count),
    reset: entry.resetAtSec,
  }
}

export async function checkPublicRateLimit(args: {
  request: NextRequest
  route: string
  limit: number
  window: Duration
  windowMsFallback: number
}): Promise<RateLimitDecision> {
  const ip = getClientIp(args.request)
  const key = `ip:${ip}:${args.route}`

  const cfg = getUpstashConfig()
  if (!cfg) {
    return checkMemoryLimit({ key, limit: args.limit, windowMs: args.windowMsFallback })
  }

  try {
    const redis = new Redis({ url: cfg.url, token: cfg.token })
    const ratelimit = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(args.limit, args.window),
      analytics: true,
      prefix: '@leadintel/public',
    })
    const res = await ratelimit.limit(key)
    return { ok: res.success, remaining: res.remaining, reset: res.reset }
  } catch {
    // If Redis errors, fail open to the memory limiter (graceful fallback).
    return checkMemoryLimit({ key, limit: args.limit, windowMs: args.windowMsFallback })
  }
}

