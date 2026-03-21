import { describe, expect, it } from 'vitest'
import { classifySignal } from './classify'

describe('classifySignal', () => {
  it('detects funding', () => {
    const c = classifySignal({ title: 'Acme raises Series A funding', snippet: null, url: 'https://example.com/x' })
    expect(c.signalType).toBe('funding')
    expect(c.confidence).toBeGreaterThanOrEqual(70)
  })

  it('detects hiring', () => {
    const c = classifySignal({ title: 'We are hiring SDRs and AEs', snippet: 'Careers', url: 'https://example.com/careers' })
    expect(c.signalType).toBe('hiring')
  })
})

