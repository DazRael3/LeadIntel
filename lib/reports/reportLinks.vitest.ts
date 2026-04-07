import { describe, expect, it } from 'vitest'
import { buildCompetitiveReportNewUrl, parseCompanyFromPitchInput } from './reportLinks'

describe('reportLinks', () => {
  it('builds new report url with params and auto', () => {
    const href = buildCompetitiveReportNewUrl({ company: 'Google', url: 'https://google.com', ticker: 'GOOG', auto: true })
    expect(href).toContain('/competitive-report?')
    expect(href).toContain('company=Google')
    expect(href).toContain('url=')
    expect(href).toContain('ticker=GOOG')
    expect(href).toContain('auto=1')
  })

  it('drops malformed hostname URLs from auto links', () => {
    const href = buildCompetitiveReportNewUrl({ company: 'Acer', url: 'https://acer', auto: true })
    expect(href).toContain('/competitive-report?')
    expect(href).toContain('company=Acer')
    expect(href).toContain('auto=1')
    expect(href).not.toContain('url=')
  })

  it('normalizes bare valid domains in auto links', () => {
    const href = buildCompetitiveReportNewUrl({ company: 'Viacom', url: 'viacom.com', auto: true })
    expect(href).toContain('url=https%3A%2F%2Fviacom.com')
  })

  it('parses pitch input as url or company', () => {
    expect(parseCompanyFromPitchInput('https://example.com').url).toBe('https://example.com')
    expect(parseCompanyFromPitchInput('example.com').url).toBe('example.com')
    expect(parseCompanyFromPitchInput('Acme Corp').company).toBe('Acme Corp')
  })
})

