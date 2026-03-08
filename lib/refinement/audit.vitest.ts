import { describe, expect, it } from 'vitest'
import { auditRefinement } from '@/lib/refinement/audit'
import { REFINEMENT_GAP_CATEGORIES } from '@/lib/refinement/gap-categories'

describe('refinement audit', () => {
  it('covers every declared gap category at least once', () => {
    const report = auditRefinement()
    const covered = new Set(report.findings.map((f) => f.category))
    for (const c of REFINEMENT_GAP_CATEGORIES) {
      expect(covered.has(c.key)).toBe(true)
    }
  })

  it('includes a summary that matches finding counts', () => {
    const report = auditRefinement()
    const ok = report.findings.filter((f) => f.status === 'ok').length
    const warn = report.findings.filter((f) => f.status === 'warn').length
    const needsAttention = report.findings.filter((f) => f.status === 'needs_attention').length
    expect(report.summary).toEqual({ ok, warn, needsAttention })
  })
})

