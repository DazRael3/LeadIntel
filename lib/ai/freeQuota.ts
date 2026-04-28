import { Redis } from '@upstash/redis'
import { logWarn } from '@/lib/observability/logger'

type AiQuotaScope = 'user' | 'global'

type AiQuotaCheckArgs = {
  userId?: string | null
  requestId: string
}

export type AiQuotaCheckResult =
  | { ok: true }
  | { ok: false; errorCode: 'AI_QUOTA_EXCEEDED'; scope: AiQuotaScope }

let cachedRedis: Redis | null | undefined
let warnedMissingStorage = false
const memoryCounters = new Map<string, number>()

function envNumber(name: string, fallback: number): number {
  const raw = (process.env[name] ?? '').trim()
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, parsed)
}

function dayKeyUtc(): string {
  return new Date().toISOString().slice(0, 10)
}

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? '').trim()
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? '').trim()
  if (!url || !token) {
    cachedRedis = null
    return cachedRedis
  }
  cachedRedis = new Redis({ url, token })
  return cachedRedis
}

function counterKey(scope: AiQuotaScope, day: string, userId?: string | null): string {
  if (scope === 'global') return `li:ai:quota:global:${day}`
  return `li:ai:quota:user:${userId ?? 'anonymous'}:${day}`
}

async function incrementMemoryCounter(key: string): Promise<number> {
  const next = (memoryCounters.get(key) ?? 0) + 1
  memoryCounters.set(key, next)
  return next
}

function maybeWarnMissingStorage(requestId: string): void {
  if (warnedMissingStorage) return
  warnedMissingStorage = true
  logWarn({
    scope: 'ai-quota',
    message: 'quota_storage_missing_fallback_memory',
    requestId,
  })
}

async function incrementCounter(
  key: string,
  requestId: string
): Promise<number> {
  const redis = getRedis()
  if (!redis) {
    maybeWarnMissingStorage(requestId)
    return incrementMemoryCounter(key)
  }
  try {
    const count = await redis.incr(key)
    if (count === 1) {
      await redis.expire(key, 60 * 60 * 24)
    }
    return count
  } catch {
    maybeWarnMissingStorage(requestId)
    return incrementMemoryCounter(key)
  }
}

export async function checkAndRecordAiQuota(
  args: AiQuotaCheckArgs
): Promise<AiQuotaCheckResult> {
  const userLimit = envNumber('AI_DAILY_USER_LIMIT', 25)
  const globalLimit = envNumber('AI_DAILY_GLOBAL_LIMIT', 1000)
  const day = dayKeyUtc()

  if (args.userId) {
    const userKey = counterKey('user', day, args.userId)
    const userCount = await incrementCounter(userKey, args.requestId)
    if (userCount > userLimit) {
      return { ok: false, errorCode: 'AI_QUOTA_EXCEEDED', scope: 'user' }
    }
  }

  const globalKey = counterKey('global', day)
  const globalCount = await incrementCounter(globalKey, args.requestId)
  if (globalCount > globalLimit) {
    return { ok: false, errorCode: 'AI_QUOTA_EXCEEDED', scope: 'global' }
  }

  return { ok: true }
}

export function __resetAiQuotaForTests(): void {
  memoryCounters.clear()
  warnedMissingStorage = false
  cachedRedis = undefined
}

