import { describe, expect, it } from 'vitest'

type WithCanonical = { metadata?: { alternates?: { canonical?: string } } }

async function expectCanonical(modulePath: string, canonical: string): Promise<void> {
  const mod = (await import(modulePath)) as WithCanonical
  expect(mod.metadata?.alternates?.canonical).toBe(canonical)
}

describe('public canonical metadata', () => {
  it('sets canonical for key conversion + trust routes', async () => {
    await expectCanonical('./pricing/page', 'https://raelinfo.com/pricing')
    await expectCanonical('./support/page', 'https://raelinfo.com/support')
    await expectCanonical('./status/page', 'https://raelinfo.com/status')
    await expectCanonical('./roadmap/page', 'https://raelinfo.com/roadmap')
    await expectCanonical('./how-scoring-works/page', 'https://raelinfo.com/how-scoring-works')
    await expectCanonical('./security/page', 'https://raelinfo.com/security')
    await expectCanonical('./privacy/page', 'https://raelinfo.com/privacy')
    await expectCanonical('./terms/page', 'https://raelinfo.com/terms')
    await expectCanonical('./acceptable-use/page', 'https://raelinfo.com/acceptable-use')
    await expectCanonical('./subprocessors/page', 'https://raelinfo.com/subprocessors')
    await expectCanonical('./dpa/page', 'https://raelinfo.com/dpa')
    await expectCanonical('./changelog/page', 'https://raelinfo.com/changelog')
    await expectCanonical('./use-cases/funding-outreach/page', 'https://raelinfo.com/use-cases/funding-outreach')
  })
})

