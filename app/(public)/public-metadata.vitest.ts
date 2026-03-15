import { describe, expect, it } from 'vitest'

type WithCanonical = { metadata?: { alternates?: { canonical?: string } } }

async function expectCanonical(modulePath: string, canonical: string): Promise<void> {
  const mod = (await import(modulePath)) as WithCanonical
  expect(mod.metadata?.alternates?.canonical).toBe(canonical)
}

describe('public canonical metadata', () => {
  it('sets canonical for key conversion + trust routes', async () => {
    await expectCanonical('./pricing/page', 'https://dazrael.com/pricing')
    await expectCanonical('./support/page', 'https://dazrael.com/support')
    await expectCanonical('./status/page', 'https://dazrael.com/status')
    await expectCanonical('./roadmap/page', 'https://dazrael.com/roadmap')
    await expectCanonical('./how-scoring-works/page', 'https://dazrael.com/how-scoring-works')
    await expectCanonical('./security/page', 'https://dazrael.com/security')
    await expectCanonical('./privacy/page', 'https://dazrael.com/privacy')
    await expectCanonical('./terms/page', 'https://dazrael.com/terms')
    await expectCanonical('./acceptable-use/page', 'https://dazrael.com/acceptable-use')
    await expectCanonical('./subprocessors/page', 'https://dazrael.com/subprocessors')
    await expectCanonical('./dpa/page', 'https://dazrael.com/dpa')
    await expectCanonical('./changelog/page', 'https://dazrael.com/changelog')
    await expectCanonical('./use-cases/funding-outreach/page', 'https://dazrael.com/use-cases/funding-outreach')
  })
})

