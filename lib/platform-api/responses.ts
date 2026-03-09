import { NextResponse } from 'next/server'
import { ok, fail, type ApiResponse, ErrorCode } from '@/lib/api/http'
import { PLATFORM_API_VERSION_HEADER, PLATFORM_API_V1 } from '@/lib/platform-api/versioning'

export function platformOk<T>(data: T, init: { status?: number; headers?: HeadersInit } = {}, requestId?: string): NextResponse<ApiResponse<T>> {
  const res = ok(data, init, undefined, requestId)
  res.headers.set(PLATFORM_API_VERSION_HEADER, PLATFORM_API_V1)
  return res as NextResponse<ApiResponse<T>>
}

export function platformFail(
  code: string,
  message: string,
  details?: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
  requestId?: string
): NextResponse<ApiResponse<never>> {
  const res = fail(code, message, details, init, undefined, requestId)
  res.headers.set(PLATFORM_API_VERSION_HEADER, PLATFORM_API_V1)
  return res as NextResponse<ApiResponse<never>>
}

export const PlatformErrorCode = {
  ...ErrorCode,
  PLATFORM_KEY_REQUIRED: 'PLATFORM_KEY_REQUIRED',
  PLATFORM_KEY_INVALID: 'PLATFORM_KEY_INVALID',
  PLATFORM_SCOPE_REQUIRED: 'PLATFORM_SCOPE_REQUIRED',
} as const

