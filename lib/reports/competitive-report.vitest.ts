import { describe, expect, it } from 'vitest'
import { generateCompetitiveIntelligenceReport } from './competitive-report'

describe('generateCompetitiveIntelligenceReport', () => {
  it('returns markdown with required headings and no self-link', async () => {
    const res = await generateCompetitiveIntelligenceReport({
      companyName: 'Google',
      companyDomain: 'google.com',
      inputUrl: 'https://google.com',
      userContext: { whatYouSell: null, idealCustomer: null },
      verifiedSignals: [],
    })

    const md = res.reportMarkdown
    expect(md).toContain('# Competitive Intelligence Report: Google')
    expect(md).toContain('## Executive summary')
    expect(md).toContain('## Market context & positioning')
    expect(md).toContain('## Competitor map')
    expect(md).toContain('## Differentiators & vulnerabilities')
    expect(md).toContain('## Buying triggers & “why now” angles')
    expect(md).toContain('## Recommended outreach angles (5)')
    expect(md).toContain('## Objection handling (5)')
    expect(md).toContain('## Suggested 7-touch sequence (email + linkedin + call openers)')
    expect(md).toContain('## Next steps checklist')
    expect(md).toContain('## Verification checklist (to avoid guessing)')
    expect(md.toLowerCase()).not.toContain('/competitive-report')

    expect(res.reportJson.sections.length).toBe(10)
  })
})

