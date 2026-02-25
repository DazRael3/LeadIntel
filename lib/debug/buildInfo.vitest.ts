import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getBuildInfo } from './buildInfo'

describe('getBuildInfo', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns an object with expected keys and does not throw when env vars are missing', () => {
    vi.stubEnv('VERCEL_GIT_REPO_SLUG', '')
    vi.stubEnv('VERCEL_GIT_REPO_OWNER', '')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', '')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '')

    const info = getBuildInfo()
    expect(info).toHaveProperty('repoSlug')
    expect(info).toHaveProperty('repoOwner')
    expect(info).toHaveProperty('branch')
    expect(info).toHaveProperty('commitSha')
  })

  it('maps Vercel env vars when present', () => {
    vi.stubEnv('VERCEL_GIT_REPO_SLUG', 'LeadIntel')
    vi.stubEnv('VERCEL_GIT_REPO_OWNER', 'DazRael3')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abcdef1234567890')

    expect(getBuildInfo()).toEqual({
      repoSlug: 'LeadIntel',
      repoOwner: 'DazRael3',
      branch: 'main',
      commitSha: 'abcdef1234567890',
    })
  })
})

