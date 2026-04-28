import { getProviderOrder } from '@/lib/ai/providerRouter'
import { generateWithCloudflare } from '@/lib/ai/providers/cloudflare'
import { generateWithGemini } from '@/lib/ai/providers/gemini'
import { generateWithGroq } from '@/lib/ai/providers/groq'
import { generateWithHuggingFace } from '@/lib/ai/providers/huggingface'
import { generateWithOpenAi } from '@/lib/ai/providers/openai'
import { generateWithTemplate } from '@/lib/ai/providers/template'
import { checkAndRecordAiQuota } from '@/lib/ai/freeQuota'
import { getAiCachedResult, setAiCachedResult } from '@/lib/ai/cache'
import type { AiGenerateInput, AiProviderAdapter, AiProviderName } from '@/lib/ai/providers/types'

function envString(name: string): string {
  const raw = process.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

function isConfigured(provider: AiProviderName): boolean {
  if (provider === 'gemini') return envString('GEMINI_API_KEY').length > 0
  if (provider === 'groq') return envString('GROQ_API_KEY').length > 0
  if (provider === 'cloudflare') {
    return envString('CLOUDFLARE_ACCOUNT_ID').length > 0 && envString('CLOUDFLARE_API_TOKEN').length > 0
  }
  if (provider === 'huggingface') return envString('HUGGINGFACE_API_KEY').length > 0
  if (provider === 'openai') return envString('OPENAI_API_KEY').length > 0
  return true
}

const adapters: Record<AiProviderName, AiProviderAdapter> = {
  gemini: generateWithGemini,
  groq: generateWithGroq,
  cloudflare: generateWithCloudflare,
  huggingface: generateWithHuggingFace,
  openai: generateWithOpenAi,
  template: generateWithTemplate,
}

async function pingProvider(provider: AiProviderName): Promise<'ok' | 'unavailable' | 'error'> {
  const adapter = adapters[provider]
  const input: AiGenerateInput = {
    task: 'subject_line',
    prompt: 'Write one short subject line about lead follow-up.',
    system: 'Return one line.',
    temperature: 0.2,
    maxTokens: 32,
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const result = await adapter(input, {
      requestId: `check-${provider}`,
      signal: controller.signal,
    })
    if (result.ok) return 'ok'
    if (result.errorCode === 'AI_PROVIDER_UNAVAILABLE') return 'unavailable'
    return 'error'
  } catch {
    return 'error'
  } finally {
    clearTimeout(timeout)
  }
}

async function main(): Promise<void> {
  const providerOrder = getProviderOrder()
  const openAiDisabled = envString('AI_DISABLE_OPENAI').toLowerCase() !== 'false'

  console.log('AI Provider Diagnostics')
  console.log('-----------------------')
  console.log(`Provider order: ${providerOrder.join(', ')}`)
  console.log(`OpenAI disabled: ${openAiDisabled ? 'true' : 'false'}`)

  const providerRows: string[] = []
  for (const provider of ['gemini', 'groq', 'cloudflare', 'huggingface', 'template', 'openai'] as const) {
    const configured = isConfigured(provider)
    const status = await pingProvider(provider)
    providerRows.push(`${provider}: configured=${configured ? 'yes' : 'no'}, ping=${status}`)
  }

  console.log('')
  console.log('Providers:')
  for (const row of providerRows) {
    console.log(`- ${row}`)
  }

  const quotaCheck = await checkAndRecordAiQuota({
    requestId: 'check-ai-providers',
    userId: 'diagnostic-user',
  })
  console.log('')
  console.log(`Quota available: ${quotaCheck.ok ? 'yes' : 'no'}`)

  const cacheInput: AiGenerateInput = {
    task: 'subject_line',
    prompt: 'Create one short subject line for outbound follow-up.',
    system: 'One line only.',
  }
  await setAiCachedResult({
    input: cacheInput,
    result: {
      ok: true,
      provider: 'template',
      model: 'deterministic-template-v1',
      text: 'Quick follow-up idea for your pipeline',
      requestId: 'diagnostic-cache-seed',
    },
  })
  const cacheHit = await getAiCachedResult(cacheInput)
  console.log(`Cache available: ${cacheHit?.ok ? 'yes' : 'no'}`)
}

void main().catch(() => {
  console.error('AI diagnostics failed')
  process.exitCode = 1
})
