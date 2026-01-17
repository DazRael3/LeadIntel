/**
 * Standardized HTTP Response Utilities
 * 
 * Provides consistent API response formats across all route handlers.
 * Ensures errors never expose stack traces or sensitive information.
 */

import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { jsonWithCookies } from '@/lib/http/json'
import { getOrCreateRequestId, setRequestIdHeader } from '@/lib/observability/request-id'
import { captureException, setRequestId } from '@/lib/observability/sentry'

/**
 * Request ID header name (exported for use in other modules)
 */
export const REQUEST_ID_HEADER = 'X-Request-ID'

/**
 * Standardized success response format
 * { ok: true, data: T }
 */
export interface SuccessResponse<T = unknown> {
  ok: true
  data: T
}

/**
 * Standardized error response format
 * { ok: false, error: { code: string, message: string, details?: unknown } }
 */
export interface ErrorResponse {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
    requestId?: string
  }
}

/**
 * Standardized API response (union type)
 */
export type ApiResponse<T = unknown> = SuccessResponse<T> | ErrorResponse

/**
 * HTTP status codes for common scenarios
 */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  FAILED_DEPENDENCY: 424,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const

/**
 * Error codes for different error types
 */
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_API_ERROR: 'EXTERNAL_API_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SCHEMA_MIGRATION_REQUIRED: 'SCHEMA_MIGRATION_REQUIRED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const

/**
 * Structured logging context (never includes secrets)
 */
interface LogContext {
  route?: string
  userId?: string
  errorCode?: string
  requestId?: string
  [key: string]: unknown
}

/**
 * Logs errors in a structured format (never logs secrets)
 * Also sends to Sentry if configured
 */
function logError(error: unknown, context: LogContext = {}): void {
  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorName = error instanceof Error ? error.name : 'UnknownError'
  
  // Never log full error objects (may contain secrets)
  // Only log safe metadata
  const logContext = {
    message: errorMessage,
    code: context.errorCode,
    userId: context.userId,
    requestId: context.requestId,
    // Never include: stack traces, request bodies, tokens, keys, passwords
  }
  
  console.error(`[${context.route || 'api'}] ${errorName}:`, logContext)
  
  // Send to Sentry if error is an Error instance
  if (error instanceof Error) {
    captureException(error, {
      requestId: context.requestId,
      route: context.route,
      userId: context.userId,
      extra: {
        errorCode: context.errorCode,
      },
    })
  }
}

/**
 * Creates a successful JSON response
 * 
 * @param data - Response payload
 * @param init - Optional response options (status, headers)
 * @param cookieBridge - Optional cookie bridge for Supabase auth cookies
 * @param requestId - Optional request ID for correlation
 * @returns NextResponse with standardized success format
 * 
 * @example
 * return ok({ plan: 'pro' }, { status: 200 }, bridge, requestId)
 */
export function ok<T>(
  data: T,
  init: { status?: number; headers?: HeadersInit } = {},
  cookieBridge?: NextResponse,
  requestId?: string
): NextResponse {
  const response: SuccessResponse<T> = {
    ok: true,
    data,
  }

  const status = init.status ?? HttpStatus.OK

  let httpResponse: NextResponse
  if (cookieBridge) {
    httpResponse = jsonWithCookies(response, { ...init, status }, cookieBridge)
  } else {
    httpResponse = NextResponse.json(response, { ...init, status })
  }

  // Add request ID to response headers if provided
  if (requestId) {
    httpResponse.headers.set(REQUEST_ID_HEADER, requestId)
  }

  return httpResponse
}

/**
 * Creates an error JSON response
 * 
 * @param code - Machine-readable error code
 * @param message - Human-readable error message
 * @param details - Optional additional error details (validation errors, etc.)
 * @param init - Optional response options (status, headers)
 * @param cookieBridge - Optional cookie bridge for Supabase auth cookies
 * @param requestId - Optional request ID for correlation
 * @returns NextResponse with standardized error format
 * 
 * @example
 * return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, { status: 401 }, bridge, requestId)
 */
export function fail(
  code: string,
  message: string,
  details?: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
  cookieBridge?: NextResponse,
  requestId?: string
): NextResponse {
  const response: ErrorResponse = {
    ok: false,
    error: {
      code,
      message,
      ...(details !== undefined && { details }),
      ...(requestId && { requestId }),
    },
  }

  // Map error codes to HTTP status codes
  const statusMap: Record<string, number> = {
    [ErrorCode.VALIDATION_ERROR]: HttpStatus.BAD_REQUEST,
    [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
    [ErrorCode.FORBIDDEN]: HttpStatus.FORBIDDEN,
    [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
    [ErrorCode.CONFLICT]: HttpStatus.CONFLICT,
    [ErrorCode.SCHEMA_MIGRATION_REQUIRED]: HttpStatus.FAILED_DEPENDENCY,
    [ErrorCode.DATABASE_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
    [ErrorCode.EXTERNAL_API_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
    [ErrorCode.INTERNAL_ERROR]: HttpStatus.INTERNAL_SERVER_ERROR,
    [ErrorCode.RATE_LIMIT_EXCEEDED]: 429, // Too Many Requests
    [ErrorCode.PAYLOAD_TOO_LARGE]: 413, // Payload Too Large
    [ErrorCode.SERVICE_UNAVAILABLE]: 503, // Service Unavailable
  }

  const status = init.status ?? statusMap[code] ?? HttpStatus.INTERNAL_SERVER_ERROR

  // Create response
  let httpResponse: NextResponse
  if (cookieBridge) {
    httpResponse = jsonWithCookies(response, { ...init, status }, cookieBridge)
  } else {
    httpResponse = NextResponse.json(response, { ...init, status })
  }

  // Merge custom headers from init
  if (init.headers) {
    const headers = new Headers(init.headers)
    headers.forEach((value, key) => {
      httpResponse.headers.set(key, value)
    })
  }

  // Add request ID to response headers
  if (requestId) {
    httpResponse.headers.set(REQUEST_ID_HEADER, requestId)
  }

  return httpResponse
}

/**
 * Converts various error types to standardized error responses
 * 
 * Handles:
 * - Zod validation errors
 * - Supabase auth errors
 * - Generic Error objects
 * - Unknown errors
 * 
 * @param error - Error to convert
 * @param route - Route name for logging context
 * @param userId - User ID for logging context
 * @param cookieBridge - Optional cookie bridge
 * @param requestId - Optional request ID for correlation
 * @returns NextResponse with standardized error format
 * 
 * @example
 * try {
 *   // ... code
 * } catch (error) {
 *   return asHttpError(error, '/api/example', user?.id, bridge, requestId)
 * }
 */
export function asHttpError(
  error: unknown,
  route?: string,
  userId?: string,
  cookieBridge?: NextResponse,
  requestId?: string
): NextResponse {
  // Set request ID in Sentry scope if available
  if (requestId) {
    setRequestId(requestId)
  }

  // Log error (structured, no secrets)
  logError(error, { route, userId, requestId })

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return fail(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
      undefined,
      cookieBridge,
      requestId
    )
  }

  // Handle Supabase auth errors
  if (error && typeof error === 'object' && 'message' in error) {
    const errorObj = error as { message: string; status?: number }
    
    // Check for common Supabase auth error patterns
    if (errorObj.message.includes('JWT') || errorObj.message.includes('token')) {
      return fail(
        ErrorCode.UNAUTHORIZED,
        'Authentication required',
        undefined,
        { status: HttpStatus.UNAUTHORIZED },
        cookieBridge,
        requestId
      )
    }

    // Check for database/schema errors
    if (
      errorObj.message.includes('schema cache') ||
      errorObj.message.includes('Could not find') ||
      errorObj.message.includes('undefined_table') ||
      errorObj.message.includes('column') && errorObj.message.includes('does not exist')
    ) {
      return fail(
        ErrorCode.SCHEMA_MIGRATION_REQUIRED,
        'Database schema migration required',
        {
          hint: 'Run the required migration and reload PostgREST schema cache',
          sqlHint: "After migration, execute: NOTIFY pgrst, 'reload schema';",
        },
        { status: HttpStatus.FAILED_DEPENDENCY },
        cookieBridge,
        requestId
      )
    }

    // Generic error with message (but never expose stack traces)
    return fail(
      ErrorCode.INTERNAL_ERROR,
      errorObj.message || 'An unexpected error occurred',
      undefined,
      { status: errorObj.status ?? HttpStatus.INTERNAL_SERVER_ERROR },
      cookieBridge,
      requestId
    )
  }

  // Handle Error objects
  if (error instanceof Error) {
    // Never expose stack traces to clients
    return fail(
      ErrorCode.INTERNAL_ERROR,
      error.message || 'An unexpected error occurred',
      undefined,
      undefined,
      cookieBridge,
      requestId
    )
  }

  // Handle unknown error types
  return fail(
    ErrorCode.INTERNAL_ERROR,
    'An unexpected error occurred',
    undefined,
    undefined,
    cookieBridge,
    requestId
  )
}

/**
 * Helper to create cookie bridge for routes that need Supabase auth cookies
 * 
 * @returns NextResponse bridge for cookie forwarding
 */
export function createCookieBridge(): NextResponse {
  return NextResponse.next()
}
