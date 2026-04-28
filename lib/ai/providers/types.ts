export type AiTaskType =
  | 'lead_summary'
  | 'outreach_draft'
  | 'subject_line'
  | 'signal_classification'
  | 'account_research_summary'
  | 'scoring_explanation'

export type AiProviderName =
  | 'gemini'
  | 'groq'
  | 'cloudflare'
  | 'huggingface'
  | 'openai'
  | 'template'

export type AiErrorCode =
  | 'AI_PROVIDER_UNAVAILABLE'
  | 'AI_RATE_LIMITED'
  | 'AI_TIMEOUT'
  | 'AI_PROVIDER_ERROR'
  | 'AI_PROVIDER_TEMPORARY'
  | 'AI_PROVIDER_MALFORMED_RESPONSE'
  | 'AI_QUOTA_EXCEEDED'
  | 'AI_PROVIDERS_UNAVAILABLE'

export type AiGenerateInput = {
  task: AiTaskType
  system?: string
  prompt: string
  temperature?: number
  maxTokens?: number
  metadata?: Record<string, unknown>
}

export type AiGenerateUsage = {
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}

export type AiGenerateResult =
  | {
      ok: true
      provider: AiProviderName
      model: string
      text: string
      usage?: AiGenerateUsage
      requestId: string
    }
  | {
      ok: false
      provider: AiProviderName | 'none'
      model: string | null
      text: ''
      usage?: AiGenerateUsage
      errorCode: AiErrorCode
      requestId: string
    }

export type AiProviderContext = {
  requestId: string
  signal: AbortSignal
}

export type AiProviderAdapter = (
  input: AiGenerateInput,
  context: AiProviderContext
) => Promise<AiGenerateResult>
