import { describe, expect, it } from 'vitest'
import { classifyRequestFailed } from './network'

describe('classifyRequestFailed', () => {
  it('classifies aborted RSC prefetch as aborted_prefetch', () => {
    expect(
      classifyRequestFailed({
        url: 'https://example.com/dashboard?_rsc=abc123',
        method: 'GET',
        failure: 'net::ERR_ABORTED',
      })
    ).toEqual({ kind: 'aborted_prefetch' })
  })

  it('classifies aborted same-origin api fetch as aborted_request', () => {
    expect(
      classifyRequestFailed({
        url: 'https://example.com/api/workspace/recipes',
        method: 'GET',
        failure: 'net::ERR_ABORTED',
      })
    ).toEqual({ kind: 'aborted_request' })
  })

  it('classifies non-abort failures as requestfailed', () => {
    expect(
      classifyRequestFailed({
        url: 'https://example.com/api/workspace/recipes',
        method: 'GET',
        failure: 'net::ERR_CONNECTION_REFUSED',
      })
    ).toEqual({ kind: 'requestfailed' })
  })
})

