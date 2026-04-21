import { describe, expect, it } from 'vitest'

import { qaAllEmailTemplates } from '@/lib/email/qa'

describe('email QA', () => {
  it('registry templates render and meet baseline quality checks', () => {
    const results = qaAllEmailTemplates({ appUrl: 'https://raelinfo.com' })
    expect(results.length).toBeGreaterThan(0)
    // Baseline: no template should be missing required structural fields.
    const structuralErrors = results.filter((r) => r.severity === 'error')
    expect(structuralErrors).toEqual([])
  })
})

