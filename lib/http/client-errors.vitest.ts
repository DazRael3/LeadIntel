import { describe, expect, it } from 'vitest'

import { mapApiErrorToClient } from './client-errors'

describe('mapApiErrorToClient', () => {
  it('maps 405 with structured invalid_method details', () => {
    const res = new Response(null, { status: 405 })
    const json = { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Method not allowed', details: { code: 'invalid_method' } } }
    const mapped = mapApiErrorToClient({ res, json })
    expect(mapped.code).toBe('invalid_method')
  })

  it('maps assistant plan required to plan_required', () => {
    const res = new Response(null, { status: 403 })
    const json = { ok: false, error: { code: 'ASSISTANT_PLAN_REQUIRED', message: 'Upgrade required.' } }
    const mapped = mapApiErrorToClient({ res, json })
    expect(mapped.code).toBe('plan_required')
  })
})

