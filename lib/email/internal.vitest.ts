import { describe, expect, it } from 'vitest'
import { renderAdminNotificationEmail, renderLeadCaptureConfirmationEmail } from '@/lib/email/internal'

describe('email internal templates', () => {
  it('adds deterministic request tag to admin notification subject', () => {
    const rendered = renderAdminNotificationEmail({
      title: 'Lead capture',
      lines: ['intent: demo'],
      appUrl: 'https://dazrael.com',
      requestId: '12345-abcd',
    })

    expect(rendered.subject).toContain('[LeadIntel Demo][12345-abcd]')
  })

  it('renders demo outline in requester follow-up when provided', () => {
    const rendered = renderLeadCaptureConfirmationEmail({
      recipientName: 'Alex',
      appUrl: 'https://dazrael.com',
      intent: 'demo',
      route: '/contact',
      company: 'Acme',
      requestId: '777-demo',
      demoPlan: {
        summary: 'Practical demo plan tailored to Acme.',
        steps: ['Step one', 'Step two', 'Step three'],
        timeToValue: '1 business day',
        aiGenerated: true,
      },
    })

    expect(rendered.subject).toContain('[LeadIntel Demo][777-demo]')
    expect(rendered.text).toContain('Auto-generated demo outline:')
    expect(rendered.text).toContain('Summary: Practical demo plan tailored to Acme.')
    expect(rendered.text).toContain('Step 1: Step one')
    expect(rendered.html).toContain('Auto-generated demo outline')
  })

  it('does not include demo outline for non-demo intents', () => {
    const rendered = renderLeadCaptureConfirmationEmail({
      recipientName: 'Alex',
      appUrl: 'https://dazrael.com',
      intent: 'pricing_question',
      route: '/contact',
      company: 'Acme',
      demoPlan: {
        summary: 'Should not render',
        steps: ['A', 'B', 'C'],
        timeToValue: '1 day',
        aiGenerated: true,
      },
    })

    expect(rendered.text).not.toContain('Auto-generated demo outline:')
    expect(rendered.html).not.toContain('Auto-generated demo outline')
  })
})
