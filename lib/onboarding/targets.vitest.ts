import { describe, expect, it } from 'vitest'
import { parseTarget, parseTargetsFromText } from '@/lib/onboarding/targets'

describe('onboarding targets', () => {
  it('parses a https URL into domain + url', () => {
    const p = parseTarget('https://www.example.com/hello?x=1')
    expect(p?.domain).toBe('example.com')
    expect(p?.url).toBe('https://example.com')
    expect(p?.name).toBe('example.com')
  })

  it('parses a domain', () => {
    const p = parseTarget('acme.io')
    expect(p?.domain).toBe('acme.io')
    expect(p?.url).toBe('https://acme.io')
  })

  it('parses a company name without inventing a domain', () => {
    const p = parseTarget('Contoso')
    expect(p?.domain).toBe(null)
    expect(p?.url).toBe(null)
    expect(p?.name).toBe('Contoso')
  })

  it('dedupes and caps parsed targets', () => {
    const parsed = parseTargetsFromText('Acme.com\nacme.com\nContoso, Contoso\nnorthwind.com', 2)
    expect(parsed.length).toBe(2)
  })
})

