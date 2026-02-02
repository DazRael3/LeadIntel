import { Redis } from '@upstash/redis'
import { serverEnv } from '@/lib/env'
import { IS_DEV, logWarn, logInfo } from '@/lib/observability/logger'

export type PlanId = 'starter' | 'closer' | 'team' | string

let hasLoggedDisabled = false
let cachedRedisConfig: { url: string; token: string } | null | undefined
let cachedRedis: Redis | null | undefined

function getDailyLimit(): number {
  const raw = (process.env.STARTER_PITCH_DAILY_LIMIT ?? '').trim()
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  const limit = Number.isFinite(parsed) ? parsed : 20
  // Safety clamp: prevent accidental 0/negative values.
  return Math.max(1, Math.min(500, limit))
}

function utcDayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD (UTC)
}

function isTestLikeEnv(): boolean {
  return (
    serverEnv.NODE_ENV === 'test' ||
    process.env.PLAYWRIGHT === '1' ||
    process.env.E2E === '1' ||
    process.env.CI === 'true'
  )
}

function getUpstashRedisConfig(): { url: string; token: string } | null {
  if (cachedRedisConfig !== undefined) return cachedRedisConfig

  const url = (process.env.UPSTASH_REDIS_REST_URL ?? '').trim()
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? '').trim()

  const hasValidUrl = /^https?:\/\//.test(url)
  const hasValidToken = token.length > 0

  if (!hasValidUrl || !hasValidToken) {
    cachedRedisConfig = null
    return cachedRedisConfig
  }

  cachedRedisConfig = { url, token }
  return cachedRedisConfig
}

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis
  if (isTestLikeEnv()) {
    cachedRedis = null
    return cachedRedis
  }
  const cfg = getUpstashRedisConfig()
  if (!cfg) {
    cachedRedis = null
    return cachedRedis
  }
  cachedRedis = new Redis({ url: cfg.url, token: cfg.token })
  return cachedRedis
}

export async function checkStarterPitchUsage(args: {
  userId: string
  planId: PlanId
  correlationId: string
}): Promise<
  | { ok: true; remaining: number; limit: number }
  | { ok: false; limit: number }
> {
  // Paid plans: no usage cap in this patch.
  if (args.planId !== 'starter') {
    return { ok: true, remaining: Number.MAX_SAFE_INTEGER, limit: Number.MAX_SAFE_INTEGER }
  }

  const limit = getDailyLimit()
  const redis = getRedis()

  // Fail-open if Redis isn't configured (common in local dev).
  if (!redis) {
    if (!hasLoggedDisabled) {
      logWarn({
        scope: 'usage',
        message: 'starter.cap.disabled',
        reason: 'redis_not_configured',
      })
      hasLoggedDisabled = true
    }
    return { ok: true, remaining: limit, limit }
  }

  const day = utcDayKey()
  const key = `li:usage:pitch:${args.userId}:${day}`

  try {
    const count = await redis.incr(key)
    if (count === 1) {
      // Per-day key; expire after 24h (safe enough for UTC date keying).
      await redis.expire(key, 60 * 60 * 24)
    }

    if (count > limit) {
      logInfo({
        scope: 'usage',
        message: 'starter.cap.reached',
        userId: args.userId,
        planId: args.planId,
        correlationId: args.correlationId,
        limit,
        day,
      })
      return { ok: false, limit }
    }

    return { ok: true, remaining: Math.max(limit - count, 0), limit }
  } catch {
    // Fail-open on Redis errors to avoid breaking pitch generation.
    if (IS_DEV) {
      logWarn({
        scope: 'usage',
        message: 'starter.cap.check_failed',
        userId: args.userId,
        correlationId: args.correlationId,
      })
    }
    return { ok: true, remaining: limit, limit }
  }
}

