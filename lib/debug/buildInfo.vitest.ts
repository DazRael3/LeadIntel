import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { getBuildInfo, getPublicVersionInfo } from './buildInfo'

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

  it('falls back to git metadata env vars when Vercel values are missing', () => {
    vi.stubEnv('VERCEL_GIT_REPO_SLUG', '')
    vi.stubEnv('VERCEL_GIT_REPO_OWNER', '')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', '')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '')
    vi.stubEnv('GITHUB_REPOSITORY', 'DazRael3/LeadIntel')
    vi.stubEnv('GITHUB_REF_NAME', 'fix/branch')
    vi.stubEnv('GITHUB_SHA', '1234567890abcdef')

    expect(getBuildInfo()).toEqual({
      repoSlug: 'LeadIntel',
      repoOwner: 'DazRael3',
      branch: 'fix/branch',
      commitSha: '1234567890abcdef',
    })
  })
})

describe('getPublicVersionInfo', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns normalized metadata and commit short hash', () => {
    vi.stubEnv('VERCEL_GIT_REPO_SLUG', 'LeadIntel')
    vi.stubEnv('VERCEL_GIT_REPO_OWNER', 'DazRael3')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', 'main')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abcdef1234567890')
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    expect(getPublicVersionInfo()).toEqual({
      appEnv: 'production',
      nodeEnv: 'production',
      deployEnv: 'production',
      repo: 'DazRael3/LeadIntel',
      branch: 'main',
      commitSha: 'abcdef1234567890',
      commitShort: 'abcdef12',
      source: 'vercel',
      metadataComplete: true,
    })
  })

  it('marks metadata as incomplete when repo/branch/sha are unavailable', () => {
    vi.stubEnv('VERCEL_GIT_REPO_SLUG', '')
    vi.stubEnv('VERCEL_GIT_REPO_OWNER', '')
    vi.stubEnv('VERCEL_GIT_COMMIT_REF', '')
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', '')
    vi.stubEnv('GITHUB_REPOSITORY', '')
    vi.stubEnv('GITHUB_REF_NAME', '')
    vi.stubEnv('GITHUB_SHA', '')
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'production')
    vi.stubEnv('NODE_ENV', 'production')

    expect(getPublicVersionInfo()).toEqual({
      appEnv: 'production',
      nodeEnv: 'production',
      deployEnv: null,
      repo: null,
      branch: null,
      commitSha: null,
      commitShort: null,
      source: 'none',
      metadataComplete: false,
    })
  })
})

