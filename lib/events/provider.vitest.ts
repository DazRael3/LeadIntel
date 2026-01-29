import { describe, expect, it, vi, beforeEach } from 'vitest'
import { composeProviders, getConfiguredProviderNames, getProviderByName } from './provider'

describe('trigger events provider pipeline', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    delete process.env.TRIGGER_EVENTS_PROVIDERS
    process.env.TRIGGER_EVENTS_PROVIDER = 'none'
    delete process.env.NEWSAPI_API_KEY
  })

  it('unknown names are ignored and fallback to none', () => {
    process.env.TRIGGER_EVENTS_PROVIDERS = 'wat,also-bad'
    expect(getConfiguredProviderNames()).toEqual(['none'])
  })

  it('legacy TRIGGER_EVENTS_PROVIDER is treated as single-element list when multi is unset', () => {
    process.env.TRIGGER_EVENTS_PROVIDER = 'custom'
    expect(getConfiguredProviderNames()).toEqual(['custom'])
  })

  it('composeProviders dedupes primarily by URL', async () => {
    const p1 = async () => [
      { title: 'A', headline: 'A', sourceUrl: 'https://example.com/1' },
      { title: 'B', headline: 'B', sourceUrl: 'https://example.com/2' },
    ]
    const p2 = async () => [
      { title: 'A dup', headline: 'A dup', sourceUrl: 'https://example.com/1' },
      { title: 'C', headline: 'C', sourceUrl: 'https://example.com/3' },
    ]

    const composite = composeProviders([p1, p2])
    const out = await composite({ companyName: 'Acme', companyDomain: 'acme.com' })
    expect(out.map((e) => e.sourceUrl)).toEqual(['https://example.com/1', 'https://example.com/2', 'https://example.com/3'])
  })

  it('newsapi provider is noop when NEWSAPI_API_KEY is missing', async () => {
    const p = getProviderByName('newsapi')
    const out = await p({ companyName: 'Acme', companyDomain: 'acme.com' })
    expect(out).toEqual([])
  })

  it('newsapi provider maps articles and respects max per provider', async () => {
    process.env.NEWSAPI_API_KEY = 'k'
    process.env.TRIGGER_EVENTS_MAX_PER_PROVIDER = '1'

    const fetchSpy = vi.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: [
          { title: 'One', url: 'https://example.com/one', description: 'd', source: { name: 'News' }, publishedAt: '2026-01-01T00:00:00Z' },
          { title: 'Two', url: 'https://example.com/two', description: 'd', source: { name: 'News' }, publishedAt: '2026-01-01T00:00:00Z' },
        ],
      }),
    } as any)

    const p = getProviderByName('newsapi')
    const out = await p({ companyName: 'Acme', companyDomain: 'acme.com' })
    expect(out.length).toBe(1)
    expect(out[0].sourceUrl).toBe('https://example.com/one')
    expect(fetchSpy).toHaveBeenCalled()
  })
})

