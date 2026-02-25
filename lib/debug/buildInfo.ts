export type BuildInfo = {
  repoSlug: string | null
  repoOwner: string | null
  branch: string | null
  commitSha: string | null
}

// Server helper: safe to call in server components / route handlers.
// In local dev these Vercel-provided env vars are typically undefined.
export function getBuildInfo(): BuildInfo {
  return {
    repoSlug: process.env.VERCEL_GIT_REPO_SLUG ?? null,
    repoOwner: process.env.VERCEL_GIT_REPO_OWNER ?? null,
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  }
}

