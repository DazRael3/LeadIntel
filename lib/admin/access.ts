import { NextRequest } from 'next/server'
import { isValidAdminToken } from '@/lib/admin/admin-token'
import { hasAdminSessionFromRequest } from '@/lib/admin/session'
import { ErrorCode } from '@/lib/api/http'

export function hasAdminAccess(request: NextRequest): boolean {
  if (hasAdminSessionFromRequest(request)) return true
  const token = (request.headers.get('x-admin-token') ?? '').trim()
  return isValidAdminToken(token)
}

export function isAdminRequestAuthorized(args: { request: NextRequest; headerToken?: string | null | undefined }): boolean {
  if (hasAdminSessionFromRequest(args.request)) return true
  const provided = (args.headerToken ?? args.request.headers.get('x-admin-token') ?? '').trim()
  return isValidAdminToken(provided)
}

export async function isAdminRequest(request: NextRequest): Promise<boolean> {
  return hasAdminAccess(request)
}

export async function isAdminApiRequest(request: NextRequest): Promise<boolean> {
  return hasAdminAccess(request)
}

export async function assertAdminAccess(
  request: NextRequest
): Promise<{ ok: true } | { ok: false; status: number; errorCode: string; message: string }> {
  if (hasAdminAccess(request)) return { ok: true }
  return { ok: false, status: 404, errorCode: ErrorCode.NOT_FOUND, message: 'Not found' }
}

export function assertAdminApiAccess(
  request: NextRequest
): { ok: true } | { ok: false; status: number; errorCode: string; message: string } {
  if (hasAdminAccess(request)) return { ok: true }
  return { ok: false, status: 401, errorCode: ErrorCode.UNAUTHORIZED, message: 'Unauthorized' }
}
