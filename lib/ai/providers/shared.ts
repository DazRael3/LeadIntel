import type { AiErrorCode, AiGenerateInput, AiGenerateResult, AiProviderName } from '@/lib/ai/providers/types'

export function envString(name: string): string {
  const raw = process.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

export function toModelResult(args: {
  provider: AiProviderName
  model: string
  text: string
  requestId: string
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}): AiGenerateResult {
  return {
    ok: true,
    provider: args.provider,
    model: args.model,
    text: args.text,
    usage: args.usage,
    requestId: args.requestId,
  }
}

export function toProviderError(args: {
  provider: AiProviderName
  requestId: string
  errorCode: AiErrorCode
  model?: string | null
}): AiGenerateResult {
  return {
    ok: false,
    provider: args.provider,
    model: args.model ?? null,
    text: '',
    errorCode: args.errorCode,
    requestId: args.requestId,
  }
}

export function combinePrompt(input: AiGenerateInput): string {
  const system = typeof input.system === 'string' ? input.system.trim() : ''
  const prompt = input.prompt.trim()
  if (!system) return prompt
  return `${system}\n\n${prompt}`
}

export function parseProviderErrorCode(status: number): AiErrorCode {
  if (status === 408 || status === 504) return 'AI_TIMEOUT'
  if (status === 429) return 'AI_RATE_LIMITED'
  if (status >= 500) return 'AI_PROVIDER_TEMPORARY'
  if (status === 404 || status === 503) return 'AI_PROVIDER_UNAVAILABLE'
  return 'AI_PROVIDER_ERROR'
}

export function normalizeTemperature(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0.3
  return Math.max(0, Math.min(1.2, value ?? 0.3))
}

export function normalizeMaxTokens(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  const safe = Math.floor(value ?? fallback)
  return Math.max(32, Math.min(4096, safe))
}
