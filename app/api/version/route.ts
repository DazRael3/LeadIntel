import { NextRequest } from 'next/server'
import { ok } from '@/lib/api/http'
import { getPublicVersionInfo, shortCommitSha } from '@/lib/debug/buildInfo'
import { serverEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

/**
 * Public, non-sensitive build/version endpoint.
 * Safe for production: exposes only repo/branch/SHA and app environment.
 */
export async function GET(_request: NextRequest) {
  const version = getPublicVersionInfo()
  return ok({
    appEnv: version.appEnv,
    nodeEnv: serverEnv.NODE_ENV,
    deployEnv: version.deployEnv,
    repo: version.repo,
    branch: version.branch,
    commitSha: version.commitSha,
    commitShort: shortCommitSha(version.commitSha),
  })
}

