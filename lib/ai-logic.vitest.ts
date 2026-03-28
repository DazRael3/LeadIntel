import { describe, expect, it } from 'vitest'

import { generatePitch, generateEmailSequence } from '@/lib/ai-logic'

describe('ai-logic copy hardening', () => {
  it('generatePitch includes the competitive report CTA link sentence', async () => {
    const pitch = await generatePitch('Acme', 'raised funding', 'Jamie', 'Context')
    // CTA should point to the in-app, one-click report generator (not the reports hub),
    // and should be safe across envs (APP_URL / NEXT_PUBLIC_SITE_URL fallback).
    expect(pitch).toContain('/competitive-report/new?auto=1')
  })

  it('generateEmailSequence uses the competitive report CTA link sentence', async () => {
    const seq = await generateEmailSequence('Acme', 'raised funding', 'Jamie', 'Context')
    expect(seq.part2).toContain('/competitive-report/new?auto=1')
    expect(seq.part3).toContain('/competitive-report/new?auto=1')
  })
})

