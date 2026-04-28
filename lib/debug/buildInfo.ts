export type BuildInfo = {
  repoSlug: string | null
  repoOwner: string | null
  branch: string | null
  commitSha: string | null
  provider: string | null
}

export type PublicVersionInfo = {
  appEnv: string | null
  nodeEnv: string | null
  deployEnv: string | null
  repo: string | null
  branch: string | null
  commitSha: string | null
  commitShort: string | null
  deploymentUrl: string | null
  buildTime: string | null
  generatedAt: string | null
  source: 'vercel' | 'github' | 'generic' | 'none'
  metadataComplete: boolean
}

const GENERATED_AT = new Date().toISOString()

function envValue(name: string): string | null {
  const value = process.env[name]
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parseGithubRepo(): { owner: string | null; slug: string | null } {
  const raw = envValue('GITHUB_REPOSITORY')
  if (!raw) return { owner: null, slug: null }
  const [owner, slug] = raw.split('/')
  if (!owner || !slug) return { owner: null, slug: null }
  return { owner, slug }
}

export function formatRepo(input: BuildInfo): string | null {
  return input.repoOwner && input.repoSlug ? `${input.repoOwner}/${input.repoSlug}` : null
}

export function shortCommitSha(commitSha: string | null, length = 8): string | null {
  if (!commitSha) return null
  if (length < 1) return commitSha
  return commitSha.slice(0, length)
}

// Server helper: safe to call in server components / route handlers.
// In local dev these Vercel-provided env vars are typically undefined.
export function getBuildInfo(): BuildInfo {
  const githubRepo = parseGithubRepo()
  const repoOwner = envValue('VERCEL_GIT_REPO_OWNER') ?? githubRepo.owner
  const repoSlug = envValue('VERCEL_GIT_REPO_SLUG') ?? githubRepo.slug

  return {
    repoSlug,
    repoOwner,
    branch:
      envValue('VERCEL_GIT_COMMIT_REF') ??
      envValue('GITHUB_REF_NAME') ??
      envValue('BRANCH_NAME') ??
      envValue('GIT_BRANCH'),
    commitSha:
      envValue('VERCEL_GIT_COMMIT_SHA') ??
      envValue('NEXT_PUBLIC_GIT_COMMIT_SHA') ??
      envValue('GITHUB_SHA') ??
      envValue('COMMIT_SHA'),
    provider: envValue('VERCEL_GIT_PROVIDER') ?? (envValue('GITHUB_REPOSITORY') ? 'github' : null),
  }
}

function resolveDeploymentUrl(): string | null {
  const raw =
    envValue('VERCEL_URL') ??
    envValue('VERCEL_PROJECT_PRODUCTION_URL') ??
    envValue('DEPLOYMENT_URL') ??
    envValue('NEXT_PUBLIC_SITE_URL')
  if (!raw) return null
  const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const parsed = new URL(withScheme)
    return parsed.origin
  } catch {
    return null
  }
}

export function getPublicVersionInfo(): PublicVersionInfo {
  const build = getBuildInfo()
  const repo = formatRepo(build)
  const hasVercelMeta = Boolean(
    envValue('VERCEL_GIT_REPO_OWNER') &&
      envValue('VERCEL_GIT_REPO_SLUG') &&
      envValue('VERCEL_GIT_COMMIT_REF') &&
      envValue('VERCEL_GIT_COMMIT_SHA')
  )
  const hasGithubMeta = Boolean(envValue('GITHUB_REPOSITORY') && envValue('GITHUB_REF_NAME') && envValue('GITHUB_SHA'))
  const source: PublicVersionInfo['source'] = hasVercelMeta ? 'vercel' : hasGithubMeta ? 'github' : repo || build.branch || build.commitSha ? 'generic' : 'none'
  const metadataComplete = Boolean(repo && build.branch && build.commitSha)

  return {
    appEnv: envValue('NEXT_PUBLIC_APP_ENV') ?? envValue('APP_ENV') ?? null,
    nodeEnv: envValue('NODE_ENV') ?? null,
    deployEnv: envValue('VERCEL_TARGET_ENV') ?? envValue('VERCEL_ENV') ?? envValue('DEPLOY_ENV') ?? null,
    repo,
    branch: build.branch,
    commitSha: build.commitSha,
    commitShort: shortCommitSha(build.commitSha),
    deploymentUrl: resolveDeploymentUrl(),
    buildTime: envValue('BUILD_TIME') ?? envValue('NEXT_BUILD_TIME') ?? null,
    generatedAt: GENERATED_AT,
    source,
    metadataComplete,
  }
}

