import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { LoginClient } from './LoginClient'

const pushMock = vi.fn()
const replaceMock = vi.fn()
const signInWithPasswordMock = vi.fn(async () => ({ error: null }))
const signUpMock = vi.fn(async () => ({ data: { user: null, session: null }, error: null }))
const getUserMock = vi.fn(async () => ({ data: { user: { id: 'u_1', email: 'user@example.com' } } }))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: signInWithPasswordMock,
      signUp: signUpMock,
      getUser: getUserMock,
    },
  }),
}))

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

vi.mock('@/lib/analytics/posthog-client', () => ({
  identifyClientUser: vi.fn(),
}))

vi.mock('@/components/BrandHero', () => ({
  BrandHero: () => <div data-testid="brand-hero" />,
}))

describe('LoginClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('NODE_ENV', 'test')
  })

  it('sign in flow does not depend on PostHog/Sentry/automation env flags', async () => {
    delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    delete process.env.NEXT_PUBLIC_POSTHOG_HOST
    delete process.env.SENTRY_DSN
    delete process.env.NEXT_PUBLIC_SENTRY_DSN
    delete process.env.CRON_SECRET
    delete process.env.EXTERNAL_CRON_SECRET

    render(<LoginClient initialMode="signin" redirectTo="/dashboard" />)
    fireEvent.change(screen.getByTestId('login-email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByTestId('login-password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByTestId('login-submit'))

    expect(signInWithPasswordMock).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password123',
    })
  })
})
