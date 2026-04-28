import { randomUUID } from 'crypto'
import { logWarn } from '@/lib/observability/logger'
import { getAiCachedResult, setAiCachedResult } from '@/lib/ai/cache'
import { checkAndRecordAiQuota } from '@/lib/ai/freeQuota'
import { generateWithCloudflare } from '@/lib/ai/providers/cloudflare'
import { generateWithGemini } from '@/lib/ai/providers/gemini'
import { generateWithGroq } from '@/lib/ai/providers/groq'
import { generateWithHuggingFace } from '@/lib/ai/providers/huggingface'
import { generateWithOpenAi } from '@/lib/ai/providers/openai'
import { generateWithTemplate } from '@/lib/ai/providers/template'
import type {
  AiGenerateInput,
  AiGenerateResult,
  AiProviderAdapter,
  AiProviderName,
} from '@/lib/ai/providers/types'
import { redactAiGenerateInput } from '@/lib/ai/redactPrompt'

const DEFAULT_PROVIDER_ORDER: AiProviderName[] = [
  'gemini',
  'groq',
  'cloudflare',
  'huggingface',
  'template',
]

const SAFE_RETRY_ERROR_CODES = new Set([
  'AI_RATE_LIMITED',
  'AI_TIMEOUT',
  'AI_PROVIDER_TEMPORARY',
  'AI_PROVIDER_UNAVAILABLE',
])

const FAILOVER_ERROR_CODES = new Set([
  'AI_RATE_LIMITED',
  'AI_TIMEOUT',
  'AI_PROVIDER_TEMPORARY',
  'AI_PROVIDER_UNAVAILABLE',
  'AI_PROVIDER_ERROR',
])

const PROVIDER_ADAPTERS: Record<AiProviderName, AiProviderAdapter> = {
  gemini: generateWithGemini,
  groq: generateWithGroq,
  cloudflare: generateWithCloudflare,
  huggingface: generateWithHuggingFace,
  openai: generateWithOpenAi,
  template: generateWithTemplate,
}

const MAX_LOG_VALUE_LENGTH = 160

function sanitizeLogValue(value: string): string {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\b(?:sk|pk|rk|re)_(?:live|test)?[_A-Za-z0-9-]{8,}\b/gi, '[REDACTED_KEY]')
    .replace(/\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/g, '[REDACTED_JWT]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LOG_VALUE_LENGTH)
}

function envString(name: string): string {
  const raw = process.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

function envInt(name: string, fallback: number): number {
  const raw = envString(name)
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(0, parsed)
}

function envBoolean(name: string, fallback: boolean): boolean {
  const raw = envString(name).toLowerCase()
  if (!raw) return fallback
  if (raw === '1' || raw === 'true') return true
  if (raw === '0' || raw === 'false') return false
  return fallback
}

function parseProviderName(value: string): AiProviderName | null {
  if (
    value === 'gemini' ||
    value === 'groq' ||
    value === 'cloudflare' ||
    value === 'huggingface' ||
    value === 'openai' ||
    value === 'template'
  ) {
    return value
  }
  return null
}

export function getProviderOrder(): AiProviderName[] {
  const configured = envString('AI_PROVIDER_ORDER')
  const disableOpenAi = envBoolean('AI_DISABLE_OPENAI', true)
  const parsed = (configured ? configured.split(',') : [])
    .map((item) => parseProviderName(item.trim().toLowerCase()))
    .filter((item): item is AiProviderName => Boolean(item))

  const unique: AiProviderName[] = []
  for (const provider of parsed.length > 0 ? parsed : DEFAULT_PROVIDER_ORDER) {
    if (!unique.includes(provider)) unique.push(provider)
  }

  if (!unique.includes('template')) {
    unique.push('template')
  }

  if (!disableOpenAi && !unique.includes('openai')) {
    unique.push('openai')
  }

  if (disableOpenAi) {
    return unique.filter((provider) => provider !== 'openai')
  }

  return unique
}

function shouldRetry(result: AiGenerateResult): boolean {
  return !result.ok && result.provider !== 'template' && SAFE_RETRY_ERROR_CODES.has(result.errorCode)
}

function shouldFailover(result: AiGenerateResult): boolean {
  return !result.ok && FAILOVER_ERROR_CODES.has(result.errorCode)
}

async function callProviderWithTimeout(args: {
  provider: AiProviderName
  adapter: AiProviderAdapter
  input: AiGenerateInput
  requestId: string
  timeoutMs: number
}): Promise<AiGenerateResult> {
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), args.timeoutMs)
  try {
    return await args.adapter(args.input, {
      requestId: args.requestId,
      signal: controller.signal,
    })
  } catch {
    return {
      ok: false,
      provider: args.provider,
      model: null,
      text: '',
      errorCode: 'AI_PROVIDER_ERROR',
      requestId: args.requestId,
    }
  } finally {
    clearTimeout(timeoutHandle)
  }
}

function getQuotaUserId(input: AiGenerateInput): string | null {
  const userId = input.metadata?.userId
  return typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : null
}

export async function generateWithProviderRouter(
  input: AiGenerateInput
): Promise<AiGenerateResult> {
  const requestId = randomUUID()
  const providerOrder = getProviderOrder()
  const maxRetries = Math.min(1, envInt('AI_MAX_RETRIES', 1))
  const timeoutMs = envInt('AI_REQUEST_TIMEOUT_MS', 15_000)
  const freeMode = envBoolean('AI_FREE_MODE', false)

  const redacted = redactAiGenerateInput(input).input
  const cached = await getAiCachedResult(redacted)
  if (cached?.ok) {
    return { ...cached, requestId }
  }

  if (freeMode) {
    const quota = await checkAndRecordAiQuota({
      requestId,
      userId: getQuotaUserId(input),
    })
    if (!quota.ok) {
      return {
        ok: false,
        provider: 'none',
        model: null,
        text: '',
        errorCode: 'AI_QUOTA_EXCEEDED',
        requestId,
      }
    }
  }

  let lastError: AiGenerateResult | null = null

  for (const provider of providerOrder) {
    const adapter = PROVIDER_ADAPTERS[provider]
    if (!adapter) continue

    let attempts = 0
    while (attempts <= maxRetries) {
      const result = await callProviderWithTimeout({
        provider,
        adapter,
        input: redacted,
        requestId,
        timeoutMs,
      })
      if (result.ok) {
        await setAiCachedResult({ input: redacted, result })
        return result
      }

      lastError = result
      const canRetry = attempts < maxRetries && shouldRetry(result)
      attempts += 1
      if (canRetry) {
        continue
      }
      break
    }

    if (!lastError || !shouldFailover(lastError)) {
      break
    }
  }

  logWarn({
    scope: 'ai-provider-router',
    message: 'providers_unavailable',
    requestId,
    attemptedProviders: providerOrder.join(','),
    lastErrorCode: !lastError || lastError.ok ? null : lastError.errorCode,
    safePromptPreview: sanitizeLogValue(redacted.prompt),
    safeSystemPreview: sanitizeLogValue(redacted.system ?? ''),
  })

  return {
    ok: false,
    provider: 'none',
    model: null,
    text: '',
    errorCode: 'AI_PROVIDERS_UNAVAILABLE',
    requestId,
  }
}
