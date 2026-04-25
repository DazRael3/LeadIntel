import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AiPitchPromptInputSchema, estimateTokenCostUsd, generateLeadPitchBundle } from '@/lib/services/ai-pitch-generation'

const completionCreateMock = vi.fn()

vi.mock('openai', () => {
  class OpenAiMock {
    chat = {
      completions: {
        create: completionCreateMock,
      },
    }
  }

  return {
    default: OpenAiMock,
  }
})

describe('ai-pitch-generation prompt input validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'sk-test-openai-key'
  })

  it('accepts optional empty payload', () => {
    const parsed = AiPitchPromptInputSchema.safeParse({})
    expect(parsed.success).toBe(true)
  })

  it('rejects too-short painPoint', () => {
    const parsed = AiPitchPromptInputSchema.safeParse({ painPoint: 'bad' })
    expect(parsed.success).toBe(false)
  })

  it('rejects too-short offerService', () => {
    const parsed = AiPitchPromptInputSchema.safeParse({ offerService: 'abc' })
    expect(parsed.success).toBe(false)
  })

  it('accepts bounded optional prompt fields', () => {
    const parsed = AiPitchPromptInputSchema.safeParse({
      painPoint: 'Slow pipeline conversion from inbound leads.',
      offerService: 'AI-assisted lead prioritization and outreach sequencing.',
      campaignObjective: 'Book qualified discovery calls.',
      callToAction: 'Would you be open to a short working session this week?',
      regenerate: true,
    })
    expect(parsed.success).toBe(true)
  })
})

describe('ai-pitch-generation token cost estimation', () => {
  it('computes deterministic positive estimate', () => {
    const estimate = estimateTokenCostUsd({ promptTokens: 2000, completionTokens: 800 })
    expect(estimate).toBeGreaterThan(0)
    expect(estimate).toBeLessThan(0.01)
  })

  it('clamps invalid token input to zero-safe estimate', () => {
    const estimate = estimateTokenCostUsd({ promptTokens: -1, completionTokens: Number.NaN })
    expect(estimate).toBe(0)
  })
})

describe('ai-pitch-generation retries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.OPENAI_API_KEY = 'sk-test-openai-key'
  })

  it('retries retryable OpenAI errors and succeeds', async () => {
    completionCreateMock
      .mockRejectedValueOnce({ status: 429, code: 'rate_limit_exceeded' })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                shortEmailOpener: 'Short opener that is long enough to satisfy validation.',
                fullColdEmail:
                  'Full cold email content that is sufficiently long to pass validation and contains context for the lead.',
                linkedinDm: 'LinkedIn DM content with practical ask and clear relevance.',
                painPointSummary: 'Pain point summary with clear context and supporting details.',
                recommendedOfferAngle: 'Offer angle tailored to the account context and goals.',
                objectionHandlingNotes:
                  'Handle objections by anchoring on context, reducing risk with scoped pilot, and proposing one measurable next step.',
              }),
            },
          },
        ],
        usage: {
          prompt_tokens: 200,
          completion_tokens: 100,
          total_tokens: 300,
        },
      })

    const result = await generateLeadPitchBundle({
      companyName: 'Acme',
      companyDomain: 'acme.com',
      companyUrl: 'https://acme.com',
      existingPitchDraft: null,
      promptInput: {},
    })

    expect(result.outputs.shortEmailOpener).toContain('Short opener')
    expect(completionCreateMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry non-retryable OpenAI errors', async () => {
    completionCreateMock.mockRejectedValueOnce({ status: 400, code: 'invalid_request_error' })

    await expect(
      generateLeadPitchBundle({
        companyName: 'Acme',
        companyDomain: 'acme.com',
        companyUrl: 'https://acme.com',
        existingPitchDraft: null,
        promptInput: {},
      })
    ).rejects.toBeTruthy()

    expect(completionCreateMock).toHaveBeenCalledTimes(1)
  })
})
