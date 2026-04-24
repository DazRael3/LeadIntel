import { describe, expect, it } from 'vitest'
import { AiPitchPromptInputSchema, estimateTokenCostUsd } from '@/lib/services/ai-pitch-generation'

describe('ai-pitch-generation prompt input validation', () => {
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
