import { describe, expect, it, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

describe('/api/version', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    delete process.env.VERCEL_GIT_REPO_OWNER
    delete process.env.VERCEL_GIT_REPO_SLUG
    delete process.env.VERCEL_GIT_COMMIT_REF
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_REPOSITORY
    delete process.env.GITHUB_REF_NAME
    delete process.env.GITHUB_SHA
  })

  it('returns ok payload even when vars missing', async () => {
    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/version'))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data).toEqual(
      expect.objectContaining({
        appEnv: null,
        nodeEnv: 'test',
        deployEnv: null,
        repo: null,
        branch: null,
        commitSha: null,
        commitShort: null,
      })
    )
  })

  it('returns public metadata without requiring admin token', async () => {
    process.env.VERCEL_GIT_REPO_OWNER = 'DazRael3'
    process.env.VERCEL_GIT_REPO_SLUG = 'LeadIntel'
    process.env.VERCEL_GIT_COMMIT_REF = 'main'
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890'

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/version'))
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.data.repo).toBe('DazRael3/LeadIntel')
    expect(json.data.branch).toBe('main')
    expect(json.data.commitSha).toBe('abcdef1234567890')
    expect(json.data.commitShort).toBe('abcdef12')
  })

  it('falls back to GitHub env metadata when Vercel metadata is unavailable', async () => {
    process.env.GITHUB_REPOSITORY = 'DazRael3/LeadIntel'
    process.env.GITHUB_REF_NAME = 'release/main'
    process.env.GITHUB_SHA = 'fedcba0987654321'

    const { GET } = await import('./route')
    const req = new NextRequest('http://localhost:3000/api/version')
    const res = await GET(req)
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.data.repo).toBe('DazRael3/LeadIntel')
    expect(json.data.branch).toBe('release/main')
    expect(json.data.commitSha).toBe('fedcba0987654321')
  })

  it('returns deploy environment when available', async () => {
    process.env.VERCEL_GIT_REPO_OWNER = 'DazRael3'
    process.env.VERCEL_GIT_REPO_SLUG = 'LeadIntel'
    process.env.VERCEL_GIT_COMMIT_REF = 'main'
    process.env.VERCEL_GIT_COMMIT_SHA = 'abcdef1234567890'
    process.env.VERCEL_ENV = 'production'
    process.env.NEXT_PUBLIC_APP_ENV = 'production'

    const { GET } = await import('./route')
    const res = await GET(new NextRequest('http://localhost:3000/api/version'))
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.data.deployEnv).toBe('production')
    expect(json.data.appEnv).toBe('production')
  })
})

