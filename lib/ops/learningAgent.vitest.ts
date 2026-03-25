import { describe, expect, it, vi } from 'vitest'

describe('learning agent (ops)', () => {
  it('generates a stable report shape even when DB reads are unavailable', async () => {
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () => {
        throw new Error('no_admin')
      },
    }))

    const mod = await import('./learningAgent')
    const report = await mod.generateLearningAgentReport({ windowDays: 7 })
    expect(report.windowDays).toBe(7)
    expect(Array.isArray(report.recommendations)).toBe(true)
    expect(typeof report.generatedAt).toBe('string')
  })
})

