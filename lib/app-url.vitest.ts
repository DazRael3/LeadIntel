import { describe, it, expect, vi, afterEach } from 'vitest'

import { getAppBaseUrl } from './app-url'

function deleteWindow(): void {
  const g = globalThis as unknown as { window?: unknown }
  delete g.window
}

describe('getAppBaseUrl', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    deleteWindow()
  })

  it('returns NEXT_PUBLIC_SITE_URL when set', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://app.example.com/')
    expect(getAppBaseUrl()).toBe('https://app.example.com')
  })

  it('falls back to window.location.origin when NEXT_PUBLIC_SITE_URL is unset', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    const g = globalThis as unknown as { window?: unknown }
    g.window = { location: { origin: 'https://example.test' } }
    expect(getAppBaseUrl()).toBe('https://example.test')
  })

  it('falls back to localhost when no env and no window', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')
    deleteWindow()
    expect(getAppBaseUrl()).toBe('http://localhost:3000')
  })
})

