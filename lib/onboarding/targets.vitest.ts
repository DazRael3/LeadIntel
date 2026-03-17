import { describe, expect, it } from 'vitest'
import { parseTarget, parseTargetsFromText } from './targets'

describe('parseTarget', () => {
  it('accepts plain company names', () => {
    expect(parseTarget('Google')?.name).toBe('Google')
    expect(parseTarget(' Google Inc ')?.name).toBe('Google Inc')
  })

  it('accepts bare domains and www-prefixed domains', () => {
    expect(parseTarget('google.com')?.domain).toBe('google.com')
    expect(parseTarget('www.google.com')?.domain).toBe('google.com')
  })

  it('accepts bare domains with trailing slash or path', () => {
    expect(parseTarget('google.com/')?.domain).toBe('google.com')
    expect(parseTarget('www.google.com/search?q=leadintel')?.domain).toBe('google.com')
  })

  it('accepts full https URLs', () => {
    expect(parseTarget('https://www.google.com/')?.domain).toBe('google.com')
  })

  it('rejects empty/invalid input', () => {
    expect(parseTarget('   ')).toBeNull()
    expect(parseTarget('..')).toBeNull()
  })
})

describe('parseTargetsFromText', () => {
  it('dedupes and caps parsed targets', () => {
    const parsed = parseTargetsFromText('Acme.com\nacme.com\nContoso, Contoso\nnorthwind.com', 2)
    expect(parsed.length).toBe(2)
  })
})

