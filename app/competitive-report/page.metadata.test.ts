import { describe, expect, it } from 'vitest'
import { generateMetadata } from './page'

describe('competitive-report metadata', () => {
  it('uses a unique title for legacy /reports redirect source', async () => {
    const meta = await generateMetadata({
      searchParams: Promise.resolve({ source: 'reports' }),
    })
    expect(meta.title).toBe('Reports Workspace | LeadIntel')
  })

  it('uses a unique title for create mode', async () => {
    const meta = await generateMetadata({
      searchParams: Promise.resolve({ create: '1' }),
    })
    expect(meta.title).toBe('Create Competitive Report | LeadIntel')
  })

  it('uses a unique title for report detail mode', async () => {
    const meta = await generateMetadata({
      searchParams: Promise.resolve({ id: 'rep_123' }),
    })
    expect(meta.title).toBe('Competitive Report Details | LeadIntel')
  })

  it('uses a unique title for auto-generate mode', async () => {
    const meta = await generateMetadata({
      searchParams: Promise.resolve({ auto: '1', company: 'Viacom' }),
    })
    expect(meta.title).toBe('Generating report for Viacom | LeadIntel')
  })
})
