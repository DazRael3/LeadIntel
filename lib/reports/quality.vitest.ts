import { describe, expect, it } from 'vitest'
import { computeReportQuality } from './quality'

describe('computeReportQuality', () => {
  it('framework-only when citations are zero', () => {
    const q = computeReportQuality({
      reportMarkdown: '# Competitive Intelligence Report: Google\n\n## Hypotheses (verify before using as fact)\n- Hypothesis: test\n',
      sourcesUsed: [],
      sourcesFetchedAt: null,
    })
    expect(q.citations).toBe(0)
    expect(q.grade).toBe('framework_only')
    expect(q.score).toBeLessThan(50)
  })

  it('scores higher with citations + fresh timestamp', () => {
    const q = computeReportQuality({
      reportMarkdown: '# Competitive Intelligence Report: Google\n\n- Fact [source 1](https://example.com)\n',
      sourcesUsed: [{ url: 'https://example.com' }],
      sourcesFetchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    })
    expect(q.citations).toBe(1)
    expect(q.score).toBeGreaterThan(0)
    expect(q.breakdown.freshnessPoints).toBeGreaterThan(0)
  })
})

