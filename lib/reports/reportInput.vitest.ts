import { describe, expect, it } from 'vitest'
import { normalizeReportInput } from './reportInput'

describe('normalizeReportInput', () => {
  it('prefers domain derived from input_url', () => {
    const res = normalizeReportInput({ input_url: 'https://example.com/path', company_name: 'X' })
    expect(res.companyDomain).toBe('example.com')
    expect(res.companyKey).toBe('example.com')
  })

  it('uses ticker key when no domain', () => {
    const res = normalizeReportInput({ ticker: 'goog' })
    expect(res.ticker).toBe('GOOG')
    expect(res.companyKey).toBe('ticker:GOOG')
  })

  it('uses name key when only name', () => {
    const res = normalizeReportInput({ company_name: 'Acme Corp' })
    expect(res.companyKey.startsWith('name:')).toBe(true)
  })
})

