import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/env', () => ({
  serverEnv: {
    NODE_ENV: 'test',
    SENTRY_DSN: undefined,
    SENTRY_ENVIRONMENT: 'test',
  },
}))

vi.mock('@sentry/nextjs', () => ({
  init: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  withScope: (cb: (scope: any) => void) => cb({ setContext: vi.fn() }),
  addBreadcrumb: vi.fn(),
  setTag: vi.fn(),
}))

describe('observability facade (sentry)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('no-ops when SENTRY_DSN is not set', async () => {
    const mod = await import('./sentry')
    const Sentry = await import('@sentry/nextjs')

    mod.initObservability()
    mod.captureMessage('test')
    mod.captureException(new Error('boom'))

    expect(vi.mocked(Sentry.init)).not.toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureMessage)).not.toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureException)).not.toHaveBeenCalled()
  })

  it('calls Sentry when SENTRY_DSN is set', async () => {
    const { serverEnv } = await import('@/lib/env')
    ;(serverEnv as any).SENTRY_DSN = 'https://examplePublicKey@o0.ingest.sentry.io/0'

    const mod = await import('./sentry')
    const Sentry = await import('@sentry/nextjs')

    mod.initObservability()
    mod.captureMessage('hello', { route: '/api/test', token: 'should_drop' })
    mod.captureException(new Error('boom'), { route: '/api/test', authorization: 'should_drop' })

    // init/capture are async (lazy import), flush microtasks
    await new Promise((r) => setTimeout(r, 10))
    expect(vi.mocked(Sentry.captureMessage)).toHaveBeenCalled()
    expect(vi.mocked(Sentry.captureException)).toHaveBeenCalled()
  })
})

