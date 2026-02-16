import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/observability/sentry', () => ({
  captureBreadcrumb: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  serverEnv: {
    NODE_ENV: 'test',
    SENTRY_DSN: '',
  },
}))

describe('metrics facade', () => {
  it('does not throw for counter/timing', async () => {
    const { recordCounter, recordTiming } = await import('./metrics')
    expect(() => recordCounter('send_pitch.success')).not.toThrow()
    expect(() => recordTiming('autopilot.run.total', 123)).not.toThrow()
  })

  it('sanitizes and truncates tags', async () => {
    const { __test } = await import('./metrics')
    const tags = __test.sanitizeTags({
      token: 'should_drop',
      route: '/api/test',
      big: 'x'.repeat(1000),
    })
    expect(tags).toBeTruthy()
    expect(tags).not.toHaveProperty('token')
    expect(tags?.route).toBe('/api/test')
    expect((tags?.big || '').length).toBeLessThan(200)
  })
})

