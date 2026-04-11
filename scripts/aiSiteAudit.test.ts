import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function auditSource(): string {
  return readFileSync(path.join(process.cwd(), 'scripts/aiSiteAudit.ts'), 'utf8')
}

describe('aiSiteAudit sample digest selector', () => {
  it('prefers stable sample company selectors first', () => {
    const source = auditSource()
    expect(source).toContain("'#sample_company'")
    expect(source).toContain("'[data-testid=\"sample-company-input\"]'")
  })

  it('never uses generic input[type=url] selector', () => {
    const source = auditSource()
    expect(source).not.toContain('input[type="url"]')
  })

  it('guards against disabled sample_email input', () => {
    const source = auditSource()
    expect(source).toContain("if (id === 'sample_email') continue")
  })
})
