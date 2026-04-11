import { afterEach, describe, expect, it } from 'vitest'
import { SUPPORT_EMAIL } from '@/lib/config/contact'
import { getResendReplyToEmail } from '@/lib/email/routing'

const originalReplyTo = process.env.RESEND_REPLY_TO_EMAIL

describe('getResendReplyToEmail', () => {
  afterEach(() => {
    if (originalReplyTo === undefined) {
      delete process.env.RESEND_REPLY_TO_EMAIL
    } else {
      process.env.RESEND_REPLY_TO_EMAIL = originalReplyTo
    }
  })

  it('returns configured email when valid', () => {
    process.env.RESEND_REPLY_TO_EMAIL = 'ops@dazrael.com'
    expect(getResendReplyToEmail()).toBe('ops@dazrael.com')
  })

  it('falls back to support email when invalid', () => {
    process.env.RESEND_REPLY_TO_EMAIL = 'LeadIntel <ops@dazrael.com>'
    expect(getResendReplyToEmail()).toBe(SUPPORT_EMAIL)
  })
})
