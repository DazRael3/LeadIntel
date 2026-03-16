import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

describe('auth utility pages semantics', () => {
  it('login page renders an H1', async () => {
    const mod = await import('./login/page')
    const el = await mod.default({ searchParams: Promise.resolve({ mode: 'signin', redirect: '/' }) })
    const html = renderToStaticMarkup(el)
    expect(html).toContain('<h1')
  })

  it('signup page renders an H1', async () => {
    const mod = await import('./signup/page')
    const el = await mod.default({ searchParams: Promise.resolve({ redirect: '/onboarding' }) })
    const html = renderToStaticMarkup(el)
    expect(html).toContain('<h1')
  })
})

