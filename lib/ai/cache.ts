import { Redis } from '@upstash/redis'
import { sha256Hex } from '@/lib/platform-api/security'
import type { AiGenerateInput, AiGenerateResult } from '@/lib/ai/providers/types'
import { containsPotentialSecret, redactAiGenerateInput } from '@/lib/ai/redactPrompt'

type CacheEntry = {
  text: string
  provider: string
  model: string
  createdAt: number
}

const DEFAULT_TTL_SECONDS = 60 * 30
let cachedRedis: Redis | null | undefined
const memoryCache = new Map<string, CacheEntry>()

function envString(name: string): string {
  const raw = process.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

function getRedis(): Redis | null {
  if (cachedRedis !== undefined) return cachedRedis
  const url = envString('UPSTASH_REDIS_REST_URL')
  const token = envString('UPSTASH_REDIS_REST_TOKEN')
  if (!url || !token) {
    cachedRedis = null
    return cachedRedis
  }
  cachedRedis = new Redis({ url, token })
  return cachedRedis
}

function normalizeForCache(input: AiGenerateInput): string {
  const redacted = redactAiGenerateInput(input).input
  const system = redacted.system?.trim() ?? ''
  const prompt = redacted.prompt.trim()
  return JSON.stringify({
    task: redacted.task,
    system,
    prompt,
    temperature: typeof redacted.temperature === 'number' ? Number(redacted.temperature.toFixed(3)) : null,
    maxTokens: redacted.maxTokens ?? null,
  })
}

export function buildAiCacheKey(input: AiGenerateInput): string {
  return `li:ai:cache:${sha256Hex(normalizeForCache(input))}`
}

function canCacheInput(input: AiGenerateInput): boolean {
  if (!['outreach_draft', 'lead_summary', 'account_research_summary', 'subject_line'].includes(input.task)) {
    return false
  }
  if (containsPotentialSecret(input.prompt)) return false
  if (typeof input.system === 'string' && containsPotentialSecret(input.system)) return false
  return true
}

export async function getAiCachedResult(input: AiGenerateInput): Promise<AiGenerateResult | null> {
  if (!canCacheInput(input)) return null
  const key = buildAiCacheKey(input)
  const redis = getRedis()
  if (redis) {
    try {
      const payload = (await redis.get(key)) as CacheEntry | null
      if (payload && typeof payload.text === 'string') {
        const provider = payload.provider
        if (
          provider === 'gemini' ||
          provider === 'groq' ||
          provider === 'cloudflare' ||
          provider === 'huggingface' ||
          provider === 'openai' ||
          provider === 'template'
        ) {
          return {
            ok: true,
            provider,
            model: payload.model,
            text: payload.text,
            requestId: 'cache-hit',
          }
        }
      }
    } catch {
      // Fall through to memory cache.
    }
  }

  const memory = memoryCache.get(key)
  if (!memory) return null
  const provider = memory.provider
  if (
    provider !== 'gemini' &&
    provider !== 'groq' &&
    provider !== 'cloudflare' &&
    provider !== 'huggingface' &&
    provider !== 'openai' &&
    provider !== 'template'
  ) {
    return null
  }
  return {
    ok: true,
    provider,
    model: memory.model,
    text: memory.text,
    requestId: 'cache-hit',
  }
}

export async function setAiCachedResult(args: {
  input: AiGenerateInput
  result: AiGenerateResult
  ttlSeconds?: number
}): Promise<void> {
  if (!args.result.ok) return
  if (!canCacheInput(args.input)) return
  const key = buildAiCacheKey(args.input)
  const entry: CacheEntry = {
    text: args.result.text,
    provider: args.result.provider,
    model: args.result.model,
    createdAt: Date.now(),
  }
  const ttl = Number.isFinite(args.ttlSeconds) ? Math.max(30, Math.floor(args.ttlSeconds ?? DEFAULT_TTL_SECONDS)) : DEFAULT_TTL_SECONDS

  const redis = getRedis()
  if (redis) {
    try {
      await redis.set(key, entry, { ex: ttl })
      return
    } catch {
      // Fall back to memory cache.
    }
  }

  memoryCache.set(key, entry)
}

export function __resetAiCacheForTests(): void {
  memoryCache.clear()
  cachedRedis = undefined
}
