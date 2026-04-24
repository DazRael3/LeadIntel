import { describe, expect, it } from 'vitest'
import {
  deduplicateLeadCandidates,
  scoreLeadFit,
  type LeadGenerationRequest,
  type GeneratedLeadCandidate,
} from '@/lib/services/lead-generation'

describe('lead-generation deduplication', () => {
  it('deduplicates by domain, email, and company name', () => {
    const candidates: GeneratedLeadCandidate[] = [
      {
        companyName: 'Acme Labs',
        companyDomain: 'acme.com',
        companyUrl: 'https://acme.com',
        contactEmail: 'ceo@acme.com',
        targetRole: 'CEO',
        industry: 'SaaS',
        location: 'Austin',
        companySize: '50-200',
      },
      {
        companyName: 'ACME Labs',
        companyDomain: 'www.acme.com',
        companyUrl: 'https://www.acme.com',
        contactEmail: 'founder@acme.com',
        targetRole: 'Founder',
        industry: 'SaaS',
        location: 'Austin',
        companySize: '51-200',
        fitNotes: ['Duplicate by domain should merge'],
      },
      {
        companyName: 'Signal Forge',
        companyDomain: 'signalforge.io',
        companyUrl: 'https://signalforge.io',
        contactEmail: 'ops@signalforge.io',
      },
      {
        companyName: 'Signal Forge',
        companyDomain: 'another-domain.io',
        companyUrl: 'https://another-domain.io',
        contactEmail: 'ops@signalforge.io',
        fitNotes: ['Duplicate by email should merge'],
      },
      {
        companyName: 'North Peak',
        companyDomain: null,
        companyUrl: null,
        contactEmail: null,
      },
      {
        companyName: 'north    peak',
        companyDomain: null,
        companyUrl: null,
        contactEmail: null,
        fitNotes: ['Duplicate by company should merge'],
      },
    ]

    const result = deduplicateLeadCandidates(candidates)

    expect(result.deduped).toHaveLength(3)
    expect(result.duplicatesRemoved).toBe(3)
  })
})

describe('lead-generation scoring', () => {
  const request: LeadGenerationRequest = {
    targetIndustry: 'Healthcare',
    location: 'Chicago',
    companySize: '200-500',
    targetRole: 'VP Sales',
    painPoint: 'slow pipeline velocity',
    offerService: 'AI lead prioritization',
    numberOfLeads: 5,
  }

  it('returns bounded score and explanation for strong matches', () => {
    const candidate: GeneratedLeadCandidate = {
      companyName: 'MediOps',
      companyDomain: 'mediops.com',
      companyUrl: 'https://mediops.com',
      contactEmail: 'vp.sales@mediops.com',
      targetRole: 'VP Sales',
      industry: 'Healthcare',
      location: 'Chicago',
      companySize: '200-500',
      fitNotes: ['Team is facing slow pipeline velocity this quarter'],
    }

    const scored = scoreLeadFit(request, candidate)
    expect(scored.score).toBeGreaterThan(80)
    expect(scored.score).toBeLessThanOrEqual(100)
    expect(scored.explanation.toLowerCase()).toContain('industry aligns')
  })

  it('keeps score in range for weak matches', () => {
    const candidate: GeneratedLeadCandidate = {
      companyName: 'Factory North',
      companyDomain: 'factorynorth.com',
      industry: 'Manufacturing',
      location: 'Seattle',
      companySize: '10-20',
      targetRole: 'Office Manager',
      fitNotes: ['No relevant pain signal'],
    }

    const scored = scoreLeadFit(request, candidate)
    expect(scored.score).toBeGreaterThanOrEqual(0)
    expect(scored.score).toBeLessThanOrEqual(100)
  })
})
