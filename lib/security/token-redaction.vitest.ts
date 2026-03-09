import { describe, expect, test } from 'vitest'
import { redactPotentialSecrets } from '@/lib/security/token-redaction'

describe('redactPotentialSecrets', () => {
  test('redacts known key prefixes', () => {
    const out = redactPotentialSecrets('stripe sk_test_1234567890 and whsec_1234567890')
    expect(out).not.toContain('sk_test_1234567890')
    expect(out).toContain('sk_[REDACTED]')
    expect(out).toContain('whsec_[REDACTED]')
  })

  test('redacts bearer tokens', () => {
    const out = redactPotentialSecrets('Authorization: Bearer abc.def.ghi')
    expect(out).toContain('Bearer [REDACTED]')
  })
})

