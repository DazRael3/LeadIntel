/**
 * Request Validation Utilities
 * 
 * Provides Zod-based validation for API route requests (JSON bodies and query parameters).
 * Ensures validation happens before any business logic or external API calls.
 */

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { fail, ErrorCode } from './http'
import { NextResponse } from 'next/server'

/**
 * Default maximum JSON body size (1MB)
 * Can be overridden per-route for endpoints that need larger payloads
 */
export const DEFAULT_MAX_JSON_BYTES = 1024 * 1024 // 1MB

/**
 * Custom error class for payload size violations
 * Allows validationError() to distinguish payload size errors from other errors
 */
export class PayloadTooLargeError extends Error {
  constructor(
    public readonly actualBytes: number,
    public readonly maxBytes: number,
    message?: string
  ) {
    super(message || `Request body too large: ${actualBytes} bytes (max: ${maxBytes} bytes)`)
    this.name = 'PayloadTooLargeError'
  }
}

/**
 * Read request body with size limit check
 * 
 * IMPORTANT: Checks Content-Length header FIRST to avoid reading large bodies into memory.
 * If Content-Length exceeds maxBytes, throws immediately without reading body.
 * 
 * @param request - Next.js request object
 * @param maxBytes - Maximum allowed body size in bytes
 * @returns Body text
 * @throws PayloadTooLargeError (413) if body is too large
 * 
 * @example
 * const bodyText = await readBodyWithLimit(request, 512 * 1024)
 */
export async function readBodyWithLimit(
  request: NextRequest,
  maxBytes: number = DEFAULT_MAX_JSON_BYTES
): Promise<string> {
  // Check Content-Length header FIRST to fail fast without reading body
  // This prevents reading large bodies into memory unnecessarily
  const contentLength = request.headers.get('content-length')
  if (contentLength) {
    const length = parseInt(contentLength, 10)
    if (!isNaN(length) && length > maxBytes) {
      throw new PayloadTooLargeError(
        length,
        maxBytes,
        `Request body too large: ${length} bytes (max: ${maxBytes} bytes). Content-Length header exceeds limit.`
      )
    }
  }

  // Read body as text to check actual size
  // Note: If Content-Length was missing or incorrect, we still need to read to verify
  // But in most cases, Content-Length check above will catch oversized requests
  const text = await request.text()
  const textBytes = new TextEncoder().encode(text).length

  if (textBytes > maxBytes) {
    throw new PayloadTooLargeError(
      textBytes,
      maxBytes,
      `Request body too large: ${textBytes} bytes (max: ${maxBytes} bytes)`
    )
  }

  return text
}

/**
 * Parse JSON from text with size limit check
 * 
 * @param request - Next.js request object
 * @param maxBytes - Maximum allowed body size in bytes
 * @returns Parsed JSON object
 * @throws PayloadTooLargeError (413) if body is too large
 * @throws Error (400) if JSON is invalid
 * 
 * @example
 * const body = await parseJsonWithLimit(request, 512 * 1024)
 */
export async function parseJsonWithLimit(
  request: NextRequest,
  maxBytes: number = DEFAULT_MAX_JSON_BYTES
): Promise<unknown> {
  const text = await readBodyWithLimit(request, maxBytes)

  // Parse JSON
  try {
    return JSON.parse(text)
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON: ${error.message}`)
    }
    throw error
  }
}

/**
 * Parse JSON from request body with size limit (legacy function, uses parseJsonWithLimit)
 * 
 * @deprecated Use parseJsonWithLimit() directly for better clarity
 * @param request - Next.js request object
 * @param options - Options including maxBytes
 * @returns Parsed JSON object
 * @throws PayloadTooLargeError if body is too large
 * @throws Error if JSON is invalid
 */
export async function parseJson(
  request: NextRequest,
  options: { maxBytes?: number } = {}
): Promise<unknown> {
  return parseJsonWithLimit(request, options.maxBytes ?? DEFAULT_MAX_JSON_BYTES)
}

/**
 * Validate request body against Zod schema
 * 
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @param options - Options including maxBytes
 * @returns Validated and parsed data
 * @throws ZodError if validation fails
 * 
 * @example
 * const body = await validateBody(request, CreateLeadSchema, { maxBytes: 512 * 1024 })
 */
export async function validateBody<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T,
  options: { maxBytes?: number } = {}
): Promise<z.infer<T>> {
  const json = await parseJsonWithLimit(request, options.maxBytes ?? DEFAULT_MAX_JSON_BYTES)
  return schema.parse(json)
}

/**
 * Validate query parameters against Zod schema
 * 
 * @param request - Next.js request object
 * @param schema - Zod schema to validate against
 * @returns Validated and parsed query parameters
 * @throws ZodError if validation fails
 * 
 * @example
 * const query = await validateQuery(request, QuerySchema)
 */
export async function validateQuery<T extends z.ZodTypeAny>(
  request: NextRequest,
  schema: T
): Promise<z.infer<T>> {
  const { searchParams } = new URL(request.url)
  
  // Convert URLSearchParams to plain object
  const queryObj: Record<string, string | string[]> = {}
  searchParams.forEach((value, key) => {
    if (queryObj[key]) {
      // Handle multiple values for same key
      const existing = queryObj[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        queryObj[key] = [existing as string, value]
      }
    } else {
      queryObj[key] = value
    }
  })

  return schema.parse(queryObj)
}

/**
 * Helper to create validation error response
 * Formats Zod errors and payload size errors into standardized error response
 * 
 * @param error - ZodError, PayloadTooLargeError, or Error
 * @param cookieBridge - Optional cookie bridge
 * @param requestId - Optional request ID for correlation
 * @returns NextResponse with validation error
 */
export function validationError(
  error: unknown,
  cookieBridge?: NextResponse,
  requestId?: string
): NextResponse {
  // Handle payload size errors with 413 status
  if (error instanceof PayloadTooLargeError) {
    return fail(
      ErrorCode.PAYLOAD_TOO_LARGE,
      'Request payload too large',
      {
        actualBytes: error.actualBytes,
        maxBytes: error.maxBytes,
        message: error.message,
      },
      { status: 413 },
      cookieBridge,
      requestId
    )
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return fail(
      ErrorCode.VALIDATION_ERROR,
      'Validation failed',
      error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
      undefined,
      cookieBridge,
      requestId
    )
  }

  // Handle generic errors
  if (error instanceof Error) {
    return fail(
      ErrorCode.VALIDATION_ERROR,
      error.message,
      undefined,
      undefined,
      cookieBridge,
      requestId
    )
  }

  return fail(
    ErrorCode.VALIDATION_ERROR,
    'Validation failed',
    undefined,
    undefined,
    cookieBridge,
    requestId
  )
}
