import { beforeEach, describe, expect, it } from 'vitest'
import type { AiGenerateInput } from '@/lib/ai/providers/types'
import { generateWithProviderRouter, getProviderOrder } from '@/lib/ai/providerRouter'
import { redactPrompt } from '@/lib/ai/redactPrompt'
import { __resetAiQuotaForTests, checkAndRecordAiQuota } from '@/lib/ai/freeQuota'
import { __resetAiCacheForTests, getAiCachedResult, setAiCachedResult } from '@/lib/ai/cache'

const defaultInput: AiGenerateInput = {
  task: 'outreach_draft',
  prompt: 'Create a short outreach draft for Acme.',
  system: 'You are helpful.',
}

describe('providerRouter order and gating', () => {
  beforeEach(() => {
    process.env.AI_PROVIDER_ORDER = 'gemini,groq,cloudflare,huggingface,template'
    process.env.AI_DISABLE_OPENAI = 'true'
  })

  it('respects provider order and excludes openai when disabled', () => {
    const order = getProviderOrder()
    expect(order).toEqual(['gemini', 'groq', 'cloudflare', 'huggingface', 'template'])
    expect(order.includes('openai')).toBe(false)
  })
})

describe('providerRouter failover', () => {
  beforeEach(() => {
    __resetAiCacheForTests()
    process.env.AI_PROVIDER_ORDER = 'gemini,groq,template'
    process.env.AI_DISABLE_OPENAI = 'true'
    process.env.AI_REQUEST_TIMEOUT_MS = '15000'
    process.env.AI_MAX_RETRIES = '1'
    delete process.env.GEMINI_API_KEY
    process.env.GROQ_API_KEY = 'groq_test'
    process.env.GROQ_MODEL = 'llama-3.3-70b-versatile'
  })

  it('falls back from gemini missing key to groq', async () => {
    const fetchMock = async () =>
      ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Groq result text' } }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20,
            total_tokens: 30,
          },
        }),
      }) as Response
    globalThis.fetch = fetchMock as typeof fetch

    const result = await generateWithProviderRouter(defaultInput)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider).toBe('groq')
      expect(result.text).toContain('Groq result text')
    }
  })

  it('falls back to template when providers fail', async () => {
    const fetchMock = async () =>
      ({
        ok: false,
        status: 429,
      }) as Response
    globalThis.fetch = fetchMock as typeof fetch

    const result = await generateWithProviderRouter(defaultInput)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider).toBe('template')
      expect(result.model).toBe('deterministic-template-v1')
    }
  })

  it('missing all provider keys still returns template fallback', async () => {
    delete process.env.GROQ_API_KEY
    delete process.env.GEMINI_API_KEY
    const result = await generateWithProviderRouter(defaultInput)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.provider).toBe('template')
    }
  })
})

describe('redaction and secret safety', () => {
  it('redacts email phone api key and jwt-like values', () => {
    const input =
      'Email me at user@example.com, call +1 555-222-3333, key sk_test_abc123456, token eyJabc.defghi.jklmnop'
    const redacted = redactPrompt(input)
    expect(redacted).not.toContain('user@example.com')
    expect(redacted).not.toContain('555-222-3333')
    expect(redacted).not.toContain('sk_test_abc123456')
    expect(redacted).not.toContain('eyJabc.defghi.jklmnop')
  })
})

describe('freeQuota guard', () => {
  beforeEach(() => {
    __resetAiQuotaForTests()
    process.env.AI_DAILY_USER_LIMIT = '1'
    process.env.AI_DAILY_GLOBAL_LIMIT = '1000'
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it('returns AI_QUOTA_EXCEEDED when daily user limit reached', async () => {
    const first = await checkAndRecordAiQuota({
      requestId: 'req_1',
      userId: 'user_123',
    })
    const second = await checkAndRecordAiQuota({
      requestId: 'req_2',
      userId: 'user_123',
    })
    expect(first.ok).toBe(true)
    expect(second.ok).toBe(false)
    if (!second.ok) {
      expect(second.errorCode).toBe('AI_QUOTA_EXCEEDED')
    }
  })
})

describe('ai cache', () => {
  beforeEach(() => {
    __resetAiCacheForTests()
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
  })

  it('returns cache hit when value is cached', async () => {
    await setAiCachedResult({
      input: defaultInput,
      result: {
        ok: true,
        provider: 'template',
        model: 'deterministic-template-v1',
        text: 'cached value',
        requestId: 'req_cache',
      },
    })
    const cached = await getAiCachedResult(defaultInput)
    expect(cached?.ok).toBe(true)
    if (cached?.ok) {
      expect(cached.text).toBe('cached value')
    }
  })
})
