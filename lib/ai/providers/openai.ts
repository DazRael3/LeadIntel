import OpenAI from 'openai'
import type { AiProviderAdapter } from '@/lib/ai/providers/types'
import { envString, normalizeMaxTokens, normalizeTemperature, toModelResult, toProviderError } from '@/lib/ai/providers/shared'

const DEFAULT_MODEL = 'gpt-4o-mini'

export const generateWithOpenAi: AiProviderAdapter = async (input, context) => {
  const apiKey = envString('OPENAI_API_KEY')
  const model = envString('OPENAI_MODEL') || DEFAULT_MODEL
  const disabled = envString('AI_DISABLE_OPENAI').toLowerCase() === 'true'
  if (!apiKey || disabled) {
    return toProviderError({
      provider: 'openai',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_UNAVAILABLE',
      model,
    })
  }

  try {
    const client = new OpenAI({ apiKey })
    const response = await client.chat.completions.create(
      {
        model,
        temperature: normalizeTemperature(input.temperature),
        max_tokens: normalizeMaxTokens(input.maxTokens, 512),
        messages: [
          ...(typeof input.system === 'string' && input.system.trim().length > 0
            ? [{ role: 'system' as const, content: input.system }]
            : []),
          { role: 'user' as const, content: input.prompt },
        ],
      },
      { signal: context.signal }
    )

    const text = response.choices?.[0]?.message?.content?.trim() ?? ''
    if (!text) {
      return toProviderError({
        provider: 'openai',
        requestId: context.requestId,
        errorCode: 'AI_PROVIDER_MALFORMED_RESPONSE',
        model,
      })
    }

    return toModelResult({
      provider: 'openai',
      model,
      text,
      requestId: context.requestId,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
      },
    })
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? (error.status as number | undefined) : undefined
    if (status === 429) {
      return toProviderError({
        provider: 'openai',
        requestId: context.requestId,
        errorCode: 'AI_RATE_LIMITED',
        model,
      })
    }
    if (typeof status === 'number' && status >= 500) {
      return toProviderError({
        provider: 'openai',
        requestId: context.requestId,
        errorCode: 'AI_PROVIDER_TEMPORARY',
        model,
      })
    }
    if (error instanceof Error && error.name === 'AbortError') {
      return toProviderError({
        provider: 'openai',
        requestId: context.requestId,
        errorCode: 'AI_TIMEOUT',
        model,
      })
    }
    return toProviderError({
      provider: 'openai',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_ERROR',
      model,
    })
  }
}
