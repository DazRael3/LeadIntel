import { NextRequest } from 'next/server'
import { fail, ErrorCode, type ApiResponse } from '@/lib/api/http'

export function methodNotAllowed(request: NextRequest, allowed: string[], requestId?: string) {
  return fail(
    ErrorCode.VALIDATION_ERROR,
    'Method not allowed',
    { code: 'invalid_method', allowed },
    { status: 405, headers: { Allow: allowed.join(', ') } },
    undefined,
    requestId
  )
}

export type StructuredApiError = {
  ok: false
  error: { code: string; message: string; details?: unknown; requestId?: string }
}

export function isStructuredApiError(json: unknown): json is StructuredApiError {
  if (!json || typeof json !== 'object') return false
  const obj = json as { ok?: unknown; error?: unknown }
  if (obj.ok !== false) return false
  if (!obj.error || typeof obj.error !== 'object') return false
  const err = obj.error as { code?: unknown; message?: unknown }
  return typeof err.code === 'string' && typeof err.message === 'string'
}

