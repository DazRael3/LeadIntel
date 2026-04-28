import { beforeEach, describe, expect, it, vi } from 'vitest'
import { generatePitch, generateEmailSequence } from '@/lib/ai-logic'

vi.mock('@/lib/ai/providerRouter', () => ({
  generateWithProviderRouter: vi.fn(),
}))

async function getRouterMock() {
  const mod = await import('@/lib/ai/providerRouter')
  return vi.mocked(mod.generateWithProviderRouter)
}

describe('ai-logic copy hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    void getRouterMock().then((mock) =>
      mock.mockResolvedValue({
        ok: true,
        provider: 'template',
        model: 'deterministic-template-v1',
        requestId: 'req_test',
        text: 'Generated content',
      })
    )
  })

  it('generatePitch includes the competitive report CTA link sentence', async () => {
    const routerMock = await getRouterMock()
    routerMock.mockResolvedValueOnce({
      ok: true,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      requestId: 'req_pitch',
      text: 'Practical outreach copy with sourced context.',
    })
    const pitch = await generatePitch('Acme', 'raised funding', 'Jamie', 'Context')
    expect(pitch).toContain('/competitive-report?auto=1')
  })

  it('generateEmailSequence uses the competitive report CTA link sentence', async () => {
    const routerMock = await getRouterMock()
    routerMock
      .mockResolvedValueOnce({
        ok: true,
        provider: 'template',
        model: 'deterministic-template-v1',
        requestId: 'req_seq_1',
        text: 'Part 1 sequence text.',
      })
      .mockResolvedValueOnce({
        ok: true,
        provider: 'template',
        model: 'deterministic-template-v1',
        requestId: 'req_seq_2',
        text: 'Part 2 sequence text.',
      })
      .mockResolvedValueOnce({
        ok: true,
        provider: 'template',
        model: 'deterministic-template-v1',
        requestId: 'req_seq_3',
        text: 'Part 3 sequence text.',
      })
    const seq = await generateEmailSequence('Acme', 'raised funding', 'Jamie', 'Context')
    expect(seq.part2).toContain('/competitive-report?auto=1')
    expect(seq.part3).toContain('/competitive-report?auto=1')
  })
})
