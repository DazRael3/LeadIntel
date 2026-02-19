import { describe, expect, it } from 'vitest'

import { generatePitch, generateEmailSequence } from '@/lib/ai-logic'

describe('ai-logic copy hardening', () => {
  it('generatePitch includes the competitive report CTA link sentence', async () => {
    const pitch = await generatePitch('Acme', 'raised funding', 'Jamie', 'Context')
    expect(pitch).toContain('View more about our intelligence platform here: https://dazrael.com/competitive-report')
    expect(pitch).not.toContain('http://dazrael.com')
  })

  it('generateEmailSequence uses the competitive report CTA link sentence', async () => {
    const seq = await generateEmailSequence('Acme', 'raised funding', 'Jamie', 'Context')
    expect(seq.part2).toContain('View more about our intelligence platform here: https://dazrael.com/competitive-report')
    expect(seq.part3).toContain('View more about our intelligence platform here: https://dazrael.com/competitive-report')
  })
})

