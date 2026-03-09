import type { NextRequest } from 'next/server'
import { checkRateLimit } from '@/lib/api/ratelimit'

export type PlatformRateCategory = 'READ' | 'WRITE'

export async function checkPlatformRateLimit(args: {
  request: NextRequest
  apiKeyId: string
  route: string
  category: PlatformRateCategory
}) {
  return checkRateLimit(args.request, args.apiKeyId, args.route, args.category)
}

