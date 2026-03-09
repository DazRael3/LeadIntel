import { describe, expect, test } from 'vitest'
import { deriveAttributionSupport, deriveTimingSummary } from '@/lib/crm-intelligence/evidence'

describe('crm-intelligence evidence', () => {
  test('deriveTimingSummary handles missing timestamps', () => {
    expect(deriveTimingSummary({ firstWorkflowAt: null, firstDownstreamAt: null }).summary).toMatch(/Insufficient/)
  })

  test('deriveTimingSummary flags downstream-before-workflow', () => {
    const wf = new Date('2026-01-10T00:00:00.000Z').toISOString()
    const ds = new Date('2026-01-09T00:00:00.000Z').toISOString()
    const out = deriveTimingSummary({ firstWorkflowAt: wf, firstDownstreamAt: ds })
    expect(out.summary).toMatch(/predates/)
    expect(out.ambiguity).toBeTruthy()
  })

  test('deriveAttributionSupport returns verified label only with verified mapping + workflow + downstream', () => {
    const out = deriveAttributionSupport({
      mappingStatus: 'verified',
      hasDownstreamObservation: true,
      hasWorkflowActivity: true,
      attributionEnabled: true,
      ambiguousVisible: false,
    })
    expect(out.label).toBe('verified_downstream_support')
  })

  test('deriveAttributionSupport returns insufficient without mapping', () => {
    const out = deriveAttributionSupport({
      mappingStatus: null,
      hasDownstreamObservation: true,
      hasWorkflowActivity: true,
      attributionEnabled: true,
      ambiguousVisible: false,
    })
    expect(out.label).toBe('insufficient_crm_data')
  })
})

