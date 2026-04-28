import type { AiProviderAdapter } from '@/lib/ai/providers/types'
import {
  envString,
  normalizeMaxTokens,
  normalizeTemperature,
  parseProviderErrorCode,
  toModelResult,
  toProviderError,
} from '@/lib/ai/providers/shared'

const DEFAULT_MODEL = 'llama-3.3-70b-versatile'

export const generateWithGroq: AiProviderAdapter = async (input, context) => {
  const apiKey = envString('GROQ_API_KEY')
  const model = envString('GROQ_MODEL') || DEFAULT_MODEL
  if (!apiKey) {
    return toProviderError({
      provider: 'groq',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_UNAVAILABLE',
      model,
    })
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      signal: context.signal,
      body: JSON.stringify({
        model,
        temperature: normalizeTemperature(input.temperature),
        max_tokens: normalizeMaxTokens(input.maxTokens, 700),
        messages: [
          ...(input.system ? [{ role: 'system', content: input.system }] : []),
          { role: 'user', content: input.prompt },
        ],
      }),
    })

    if (!response.ok) {
      return toProviderError({
        provider: 'groq',
        requestId: context.requestId,
        errorCode: parseProviderErrorCode(response.status),
        model,
      })
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
    }

    const text = payload.choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) {
      return toProviderError({
        provider: 'groq',
        requestId: context.requestId,
        errorCode: 'AI_PROVIDER_MALFORMED_RESPONSE',
        model,
      })
    }

    return toModelResult({
      provider: 'groq',
      model,
      text,
      requestId: context.requestId,
      usage: {
        promptTokens: payload.usage?.prompt_tokens,
        completionTokens: payload.usage?.completion_tokens,
        totalTokens: payload.usage?.total_tokens,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return toProviderError({
        provider: 'groq',
        requestId: context.requestId,
        errorCode: 'AI_TIMEOUT',
        model,
      })
    }
    return toProviderError({
      provider: 'groq',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_ERROR',
      model,
    })
  }
}
