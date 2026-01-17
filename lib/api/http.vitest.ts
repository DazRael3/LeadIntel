/**
 * HTTP Response Helpers Tests (Vitest)
 * 
 * Tests for http.ts response utilities (ok, fail, asHttpError).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { ok, fail, asHttpError, ErrorCode, HttpStatus, createCookieBridge } from './http'
import { AuthApiError } from '@supabase/supabase-js'

// Mock jsonWithCookies
vi.mock('@/lib/http/json', () => ({
  jsonWithCookies: (data: unknown, init?: ResponseInit, bridge?: NextResponse) => {
    const response = NextResponse.json(data, init)
    // Copy cookies from bridge
    if (bridge) {
      bridge.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') {
          response.headers.append('Set-Cookie', value)
        }
      })
    }
    return response
  },
}))

describe('ok', () => {
  it('should create success response with default status', async () => {
    const data = { plan: 'pro', userId: '123' }
    const response = ok(data)

    expect(response.status).toBe(HttpStatus.OK)

    const body = await response.json()
    expect(body).toEqual({
      ok: true,
      data,
    })
  })

  it('should create success response with custom status', async () => {
    const data = { id: '123' }
    const response = ok(data, { status: HttpStatus.CREATED })

    expect(response.status).toBe(HttpStatus.CREATED)

    const body = await response.json()
    expect(body).toEqual({
      ok: true,
      data,
    })
  })

  it('should forward cookies from bridge', () => {
    const bridge = createCookieBridge()
    bridge.headers.set('Set-Cookie', 'test=value')

    const data = { test: true }
    const response = ok(data, {}, bridge)

    expect(response.headers.get('Set-Cookie')).toBe('test=value')
  })
})

describe('fail', () => {
  it('should create error response with default status', async () => {
    const response = fail(ErrorCode.INTERNAL_ERROR, 'Something went wrong')

    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)

    const body = await response.json()
    expect(body).toEqual({
      ok: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Something went wrong',
      },
    })
  })

  it('should create error response with mapped status code', async () => {
    const response = fail(ErrorCode.UNAUTHORIZED, 'Authentication required')

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED)

    const body = await response.json()
    expect(body).toEqual({
      ok: false,
      error: {
        code: ErrorCode.UNAUTHORIZED,
        message: 'Authentication required',
      },
    })
  })

  it('should include details when provided', async () => {
    const details = { field: 'email', reason: 'Invalid format' }
    const response = fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', details)

    const body = await response.json()
    expect(body).toEqual({
      ok: false,
      error: {
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Validation failed',
        details,
      },
    })
  })

  it('should use custom status when provided', () => {
    const response = fail(ErrorCode.VALIDATION_ERROR, 'Error', undefined, { status: 422 })

    expect(response.status).toBe(422)
  })

  it('should map PAYLOAD_TOO_LARGE to 413', () => {
    const response = fail(ErrorCode.PAYLOAD_TOO_LARGE, 'Payload too large')

    expect(response.status).toBe(413)
  })

  it('should map RATE_LIMIT_EXCEEDED to 429', () => {
    const response = fail(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded')

    expect(response.status).toBe(429)
  })

  it('should forward cookies from bridge', () => {
    const bridge = createCookieBridge()
    bridge.headers.set('Set-Cookie', 'test=value')

    const response = fail(ErrorCode.INTERNAL_ERROR, 'Error', undefined, undefined, bridge)

    expect(response.headers.get('Set-Cookie')).toBe('test=value')
  })
})

describe('asHttpError', () => {
  beforeEach(() => {
    // Suppress console.error in tests
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('should handle ZodError', async () => {
    const zodError = new ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['name'],
        message: 'Expected string, received number',
      },
    ])

    const response = asHttpError(zodError, '/api/test')

    expect(response.status).toBe(HttpStatus.BAD_REQUEST)

    const body = await response.json()
    expect(body).toHaveProperty('ok', false)
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const errorObj = body.error as { code: string; details: unknown }
      expect(errorObj.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(Array.isArray(errorObj.details)).toBe(true)
    }
  })

  it('should handle AuthApiError', async () => {
    const authError = new AuthApiError('Invalid token', 401, 'invalid_token')

    const response = asHttpError(authError, '/api/test')

    expect(response.status).toBe(HttpStatus.UNAUTHORIZED)

    const body = await response.json()
    expect(body).toHaveProperty('ok', false)
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const errorObj = body.error as { code: string }
      expect(errorObj.code).toBe(ErrorCode.UNAUTHORIZED)
    }
  })

  it('should handle generic Error', async () => {
    const error = new Error('Something went wrong')

    const response = asHttpError(error, '/api/test')

    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)

    const body = await response.json()
    expect(body).toHaveProperty('ok', false)
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const errorObj = body.error as { code: string; message: string }
      expect(errorObj.code).toBe(ErrorCode.INTERNAL_ERROR)
      expect(errorObj.message).toBe('Something went wrong')
    }
  })

  it('should handle unknown error types', async () => {
    const unknownError = { someProperty: 'value' }

    const response = asHttpError(unknownError, '/api/test')

    expect(response.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR)

    const body = await response.json()
    expect(body).toHaveProperty('ok', false)
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const errorObj = body.error as { code: string }
      expect(errorObj.code).toBe(ErrorCode.INTERNAL_ERROR)
    }
  })

  it('should log errors with context', () => {
    const consoleSpy = vi.spyOn(console, 'error')
    const error = new Error('Test error')

    asHttpError(error, '/api/test', 'user-123')

    expect(consoleSpy).toHaveBeenCalled()
    const callArgs = consoleSpy.mock.calls[0]
    expect(callArgs[0]).toContain('/api/test')
  })

  it('should forward cookies from bridge', () => {
    const bridge = createCookieBridge()
    bridge.headers.set('Set-Cookie', 'test=value')

    const error = new Error('Test')
    const response = asHttpError(error, '/api/test', undefined, bridge)

    expect(response.headers.get('Set-Cookie')).toBe('test=value')
  })
})

describe('createCookieBridge', () => {
  it('should create a NextResponse bridge', () => {
    const bridge = createCookieBridge()

    expect(bridge).toBeInstanceOf(NextResponse)
  })
})
