import { describe, expect, it } from 'vitest'
import { computeImportedSlug } from '@/lib/services/rollout-workflows'

describe('computeImportedSlug', () => {
  it('adds a stable imported suffix', () => {
    const slug = computeImportedSlug({ slug: 'funding-email-1-short', originTemplateId: '123e4567-e89b-12d3-a456-426614174000' })
    expect(slug).toContain('funding-email-1-short-imported-')
    expect(slug.length).toBeLessThanOrEqual(80)
  })
})

