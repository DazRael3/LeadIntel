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

const DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct'

export const generateWithCloudflare: AiProviderAdapter = async (input, context) => {
  const accountId = envString('CLOUDFLARE_ACCOUNT_ID')
  const apiToken = envString('CLOUDFLARE_API_TOKEN')
  const model = envString('CLOUDFLARE_WORKERS_AI_MODEL') || DEFAULT_MODEL
  if (!accountId || !apiToken) {
    return toProviderError({
      provider: 'cloudflare',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_UNAVAILABLE',
      model,
    })
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${encodeURIComponent(model)}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiToken}`,
        'content-type': 'application/json',
      },
      signal: context.signal,
      body: JSON.stringify({
        messages: [{ role: 'user', content: combinePrompt(input) }],
        temperature: normalizeTemperature(input.temperature),
        max_tokens: normalizeMaxTokens(input.maxTokens, 600),
      }),
    })

    if (!response.ok) {
      return toProviderError({
        provider: 'cloudflare',
        requestId: context.requestId,
        errorCode: parseProviderErrorCode(response.status),
        model,
      })
    }

    const payload = (await response.json()) as {
      success?: boolean
      result?: { response?: string; usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number } }
    }

    const text = payload.result?.response?.trim() ?? ''
    if (!text) {
      return toProviderError({
        provider: 'cloudflare',
        requestId: context.requestId,
        errorCode: 'AI_PROVIDER_MALFORMED_RESPONSE',
        model,
      })
    }

    return toModelResult({
      provider: 'cloudflare',
      model,
      text,
      requestId: context.requestId,
      usage: {
        promptTokens: payload.result?.usage?.input_tokens,
        completionTokens: payload.result?.usage?.output_tokens,
        totalTokens: payload.result?.usage?.total_tokens,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return toProviderError({
        provider: 'cloudflare',
        requestId: context.requestId,
        errorCode: 'AI_TIMEOUT',
        model,
      })
    }
    return toProviderError({
      provider: 'cloudflare',
      requestId: context.requestId,
      errorCode: 'AI_PROVIDER_ERROR',
      model,
    })
  }
}
