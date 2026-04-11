import { afterEach, describe, expect, it } from 'vitest'
import { renderLeadCaptureConfirmationEmail } from '@/lib/email/internal'

const originalBrandImageUrl = process.env.EMAIL_BRAND_IMAGE_URL

describe('renderLeadCaptureConfirmationEmail', () => {
  afterEach(() => {
    if (originalBrandImageUrl === undefined) {
      delete process.env.EMAIL_BRAND_IMAGE_URL
    } else {
      process.env.EMAIL_BRAND_IMAGE_URL = originalBrandImageUrl
    }
  })

  it('keeps non-consent follow-ups strictly transactional', () => {
    const rendered = renderLeadCaptureConfirmationEmail({
      appUrl: 'https://dazrael.com',
      formType: 'demo',
      sourcePage: '/contact',
      consentMarketing: false,
      recipientName: 'Alex',
      company: 'Acme',
      variationSeed: 'seed-1',
    })

    expect(rendered.text).toContain('Support: https://dazrael.com/support')
    expect(rendered.text).toContain('Email preferences: https://dazrael.com/support#email-preferences')
    expect(rendered.text).not.toContain('Pricing: https://dazrael.com/pricing')
    expect(rendered.text).not.toContain('Sample digest: https://dazrael.com/#try-sample')
    expect(rendered.html).toContain('Open support')
    expect(rendered.html).not.toContain('Review pricing')
    expect(rendered.html).not.toContain('Generate another sample')
  })

  it('keeps marketing CTAs when consent is granted', () => {
    const rendered = renderLeadCaptureConfirmationEmail({
      appUrl: 'https://dazrael.com',
      formType: 'demo',
      sourcePage: '/contact',
      consentMarketing: true,
      recipientName: 'Alex',
      company: 'Acme',
      variationSeed: 'seed-2',
    })

    expect(rendered.text).toContain('Pricing: https://dazrael.com/pricing')
    expect(rendered.text).toContain('Sample digest: https://dazrael.com/#try-sample')
    expect(rendered.html).toContain('Review pricing')
    expect(rendered.html).toContain('Generate another sample')
  })

  it('ignores invalid brand image env values safely', () => {
    process.env.EMAIL_BRAND_IMAGE_URL = 'not-a-valid-url'
    const rendered = renderLeadCaptureConfirmationEmail({
      appUrl: 'https://dazrael.com',
      formType: 'demo',
      sourcePage: '/contact',
      consentMarketing: true,
    })
    expect(rendered.html).not.toContain('<img src=')
  })
})
