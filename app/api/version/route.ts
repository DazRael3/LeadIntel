import { NextRequest } from 'next/server'
import { ok } from '@/lib/api/http'
import { getBuildInfo } from '@/lib/debug/buildInfo'
import { serverEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Public, non-sensitive build/version endpoint.
 * Safe for production: exposes only repo/branch/SHA and app environment.
 */
export async function GET(_request: NextRequest) {
  const build = getBuildInfo()
  return ok({
    appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? null,
    nodeEnv: serverEnv.NODE_ENV,
    repo: build.repoOwner && build.repoSlug ? `${build.repoOwner}/${build.repoSlug}` : null,
    branch: build.branch,
    commitSha: build.commitSha,
  })
}

