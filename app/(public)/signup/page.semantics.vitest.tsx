import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('../login/LoginClient', () => ({
  LoginClient: () => <div data-testid="login-client-stub" />,
}))

describe('signup page semantics', () => {
  it('renders an H1 (utility page is not unfinished)', async () => {
    const mod = await import('./page')
    const el = await mod.default({ searchParams: Promise.resolve({ redirect: '/onboarding' }) })
    const html = renderToStaticMarkup(el)
    expect(html).toContain('<h1')
  })
})

