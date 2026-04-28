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

const DEFAULT_MODEL = 'gemini-2.5-flash'

export const generateWithGemini: AiProviderAdapter = async (input, context) => {
  const apiKey = envString('GEMINI_API_KEY')
  const model = envString('GEMINI_MODEL') || DEFAULT_MODEL
  if (!apiKey) {
    return toProviderError({
      provider: 'gemini',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_UNAVAILABLE',
      model,
    })
  }

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      signal: context.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: combinePrompt(input) }] }],
        generationConfig: {
          temperature: normalizeTemperature(input.temperature),
          maxOutputTokens: normalizeMaxTokens(input.maxTokens, 512),
        },
      }),
    })

    if (!response.ok) {
      return toProviderError({
        provider: 'gemini',
        requestId: context.requestId,
        errorCode: parseProviderErrorCode(response.status),
        model,
      })
    }

    const payload = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
      usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
      }
    }

    const text =
      payload.candidates?.[0]?.content?.parts
        ?.map((part) => (typeof part?.text === 'string' ? part.text : ''))
        .join('\n')
        .trim() ?? ''

    if (!text) {
      return toProviderError({
        provider: 'gemini',
        requestId: context.requestId,
        errorCode: 'AI_PROVIDER_MALFORMED_RESPONSE',
        model,
      })
    }

    return toModelResult({
      provider: 'gemini',
      model,
      text,
      requestId: context.requestId,
      usage: {
        promptTokens: payload.usageMetadata?.promptTokenCount,
        completionTokens: payload.usageMetadata?.candidatesTokenCount,
        totalTokens: payload.usageMetadata?.totalTokenCount,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return toProviderError({
        provider: 'gemini',
        requestId: context.requestId,
        errorCode: 'AI_TIMEOUT',
        model,
      })
    }
    return toProviderError({
      provider: 'gemini',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_ERROR',
      model,
    })
  }
}
