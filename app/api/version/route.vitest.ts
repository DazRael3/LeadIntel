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
        repo: null,
        branch: null,
        commitSha: null,
      })
    )
  })

  it('includes repo/branch/sha when present', async () => {
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
  })
})

