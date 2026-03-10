import { NextRequest } from 'next/server'
import { getRequestId } from '@/lib/api/with-request-id'
import { platformOk } from '@/lib/platform-api/responses'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request)
  return platformOk({ status: 'ok' as const, version: 'v1' as const }, undefined, requestId)
}

