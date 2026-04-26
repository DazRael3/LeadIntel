import { describe, expect, it } from 'vitest'
import { ensureReportHeadings, looksLikeEmail, stripSelfReferentialLinks } from './reportFormatGuards'

describe('reportFormatGuards', () => {
  it('detects email-style content', () => {
    expect(looksLikeEmail('Subject: Hello\n\nDear team,\n\nBest regards,\nMe')).toBe(true)
    expect(looksLikeEmail('# Competitive Intelligence Report: Google\n\n## Executive summary\nFramework-based.\n')).toBe(false)
  })

  it('strips self-referential competitive-report links', () => {
    const input = `# Competitive Intelligence Report: Google

View the report here: https://raelinfo.com/competitive-report?id=abc

## Executive summary
Hello`
    const out = stripSelfReferentialLinks(input)
    expect(out.toLowerCase()).not.toContain('competitive-report')
    expect(out).toContain('## Executive summary')
  })

  it('ensures the top heading exists', () => {
    const out = ensureReportHeadings('## Executive summary\nx', 'Google')
    expect(out.startsWith('# Competitive Intelligence Report: Google')).toBe(true)
  })
})

