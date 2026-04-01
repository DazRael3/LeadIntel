import { NextRequest } from 'next/server'
import { ok } from '@/lib/api/http'
import { getBuildInfo } from '@/lib/debug/buildInfo'
import { serverEnv } from '@/lib/env'
import { isValidAdminToken } from '@/lib/admin/admin-token'

export const dynamic = 'force-dynamic'

/**
 * Public, non-sensitive build/version endpoint.
 * Safe for production: exposes only repo/branch/SHA and app environment.
 */
export async function GET(_request: NextRequest) {
  const adminToken = (_request.headers.get('x-admin-token') ?? '').trim()
  const includeBuildDetails = isValidAdminToken(adminToken)
  const build = getBuildInfo()
  return ok({
    appEnv: process.env.NEXT_PUBLIC_APP_ENV ?? null,
    nodeEnv: serverEnv.NODE_ENV,
    repo: includeBuildDetails && build.repoOwner && build.repoSlug ? `${build.repoOwner}/${build.repoSlug}` : null,
    branch: includeBuildDetails ? build.branch : null,
    commitSha: includeBuildDetails ? build.commitSha : null,
  })
}

