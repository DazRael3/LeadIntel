import type { AiProviderAdapter } from '@/lib/ai/providers/types'
import {
  combinePrompt,
  envString,
  normalizeMaxTokens,
  normalizeTemperature,
  parseProviderErrorCode,
  toModelResult,
  toProviderError,
} from '@/lib/ai/providers/shared'

const DEFAULT_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3'

export const generateWithHuggingFace: AiProviderAdapter = async (input, context) => {
  const apiKey = envString('HUGGINGFACE_API_KEY')
  const model = envString('HUGGINGFACE_MODEL') || DEFAULT_MODEL
  if (!apiKey) {
    return toProviderError({
      provider: 'huggingface',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_UNAVAILABLE',
      model,
    })
  }

  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        signal: context.signal,
        body: JSON.stringify({
          inputs: combinePrompt(input),
          parameters: {
            temperature: normalizeTemperature(input.temperature),
            max_new_tokens: normalizeMaxTokens(input.maxTokens, 512),
            return_full_text: false,
          },
        }),
      }
    )

    if (!response.ok) {
      return toProviderError({
        provider: 'huggingface',
        requestId: context.requestId,
        errorCode: parseProviderErrorCode(response.status),
        model,
      })
    }

    const payload = (await response.json()) as
      | Array<{ generated_text?: string }>
      | { generated_text?: string }
    const text = Array.isArray(payload)
      ? (payload[0]?.generated_text ?? '').trim()
      : (payload.generated_text ?? '').trim()

    if (!text) {
      return toProviderError({
        provider: 'huggingface',
        requestId: context.requestId,
        errorCode: 'AI_PROVIDER_MALFORMED_RESPONSE',
        model,
      })
    }

    return toModelResult({
      provider: 'huggingface',
      model,
      text,
      requestId: context.requestId,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return toProviderError({
        provider: 'huggingface',
        requestId: context.requestId,
        errorCode: 'AI_TIMEOUT',
        model,
      })
    }
    return toProviderError({
      provider: 'huggingface',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_ERROR',
      model,
    })
  }
}
