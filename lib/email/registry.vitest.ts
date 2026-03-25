import { describe, expect, it } from 'vitest'

import { EMAIL_TEMPLATES, getEmailTemplate } from '@/lib/email/registry'

describe('email template registry', () => {
  it('has unique IDs and templates are retrievable', () => {
    expect(EMAIL_TEMPLATES.length).toBeGreaterThan(0)
    const ids = EMAIL_TEMPLATES.map((t) => t.meta.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) {
      expect(getEmailTemplate(id as any)).not.toBeNull()
    }
  })
})

