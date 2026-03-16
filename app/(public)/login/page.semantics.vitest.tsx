import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('./LoginClient', () => ({
  LoginClient: () => <div data-testid="login-client-stub" />,
}))

describe('login page semantics', () => {
  it('renders an H1 (utility page is not unfinished)', async () => {
    const mod = await import('./page')
    const el = await mod.default({ searchParams: Promise.resolve({ mode: 'signin', redirect: '/' }) })
    const html = renderToStaticMarkup(el)
    expect(html).toContain('<h1')
  })
})

