import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { getUpdateText } from './relativeUpdateText'

describe('getUpdateText', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('null/undefined -> Updated just now', () => {
    expect(getUpdateText(null)).toBe('Never updated yet')
    expect(getUpdateText(undefined)).toBe('Never updated yet')
  })

  it('~10 seconds ago -> Updated just now', () => {
    const last = new Date(Date.now() - 9_000)
    expect(getUpdateText(last)).toBe('Updated just now')
  })

  it('~45 seconds ago -> Updated less than a minute ago', () => {
    const last = new Date(Date.now() - 45_000)
    expect(getUpdateText(last)).toBe('Updated less than a minute ago')
  })

  it('90 seconds ago -> Updated 1 minute ago', () => {
    const last = new Date(Date.now() - 90_000)
    expect(getUpdateText(last)).toBe('Updated 1 minute ago')
  })

  it('10 minutes ago -> Updated 10 minutes ago', () => {
    const last = new Date(Date.now() - 10 * 60_000)
    expect(getUpdateText(last)).toBe('Updated 10 minutes ago')
  })

  it('2 hours ago -> Updated over an hour ago', () => {
    const last = new Date(Date.now() - 2 * 60 * 60_000)
    expect(getUpdateText(last)).toBe('Updated 2 hours ago')
  })
})

