/**
 * Request Validation Utilities Tests (Vitest)
 * 
 * Tests for validate.ts helpers including payload size limits and JSON parsing.
 */

import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  parseJson,
  readBodyWithLimit,
  parseJsonWithLimit,
  validateBody,
  validateQuery,
  validationError,
  DEFAULT_MAX_JSON_BYTES,
  PayloadTooLargeError,
} from './validate'
import { ErrorCode } from './http'
import { createCookieBridge } from './http'

describe('readBodyWithLimit', () => {
  it('should read body within size limit', async () => {
    const bodyText = 'x'.repeat(512 * 1024) // 512KB
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: bodyText,
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await readBodyWithLimit(request, 1024 * 1024) // 1MB limit
    expect(result).toBe(bodyText)
  })

  it('should throw PayloadTooLargeError (413) when body exceeds limit (Content-Length header)', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: 'x'.repeat(2 * 1024 * 1024), // 2MB body
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024), // 2MB in header
      },
    })

    await expect(readBodyWithLimit(request, 1024 * 1024)).rejects.toThrow(PayloadTooLargeError)

    try {
      await readBodyWithLimit(request, 1024 * 1024)
      expect.fail('Should have thrown PayloadTooLargeError')
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadTooLargeError)
      if (error instanceof PayloadTooLargeError) {
        expect(error.actualBytes).toBe(2 * 1024 * 1024)
        expect(error.maxBytes).toBe(1024 * 1024)
      }
    }
  })

  it('should throw PayloadTooLargeError (413) when body exceeds limit (actual body)', async () => {
    const largeBody = 'x'.repeat(2 * 1024 * 1024) // 2MB
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: largeBody,
      headers: { 'Content-Type': 'application/json' },
      // No Content-Length header - will read body to check
    })

    try {
      await readBodyWithLimit(request, 1024 * 1024)
      expect.fail('Should have thrown PayloadTooLargeError')
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadTooLargeError)
      if (error instanceof PayloadTooLargeError) {
        expect(error.actualBytes).toBeGreaterThan(error.maxBytes)
      }
    }
  })
})

describe('parseJsonWithLimit', () => {
  it('should parse valid JSON within size limit', async () => {
    const json = { name: 'test', value: 123 }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseJsonWithLimit(request, DEFAULT_MAX_JSON_BYTES)
    expect(result).toEqual(json)
  })

  it('should throw PayloadTooLargeError (413) when body exceeds limit', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: 'x'.repeat(2 * 1024 * 1024), // 2MB body
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024),
      },
    })

    await expect(parseJsonWithLimit(request, 1024 * 1024)).rejects.toThrow(PayloadTooLargeError)
  })

  it('should throw Error (400) for invalid JSON', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: '{ invalid json }',
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(parseJsonWithLimit(request, DEFAULT_MAX_JSON_BYTES)).rejects.toThrow('Invalid JSON')
  })

  it('should throw PayloadTooLargeError (413) before parsing invalid JSON', async () => {
    // If body is too large, should get 413, not 400
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: '{ invalid json }'.repeat(100000), // Large invalid JSON
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String('{ invalid json }'.repeat(100000).length),
      },
    })

    await expect(parseJsonWithLimit(request, 1024)).rejects.toThrow(PayloadTooLargeError)
    await expect(parseJsonWithLimit(request, 1024)).rejects.not.toThrow('Invalid JSON')
  })
})

describe('parseJson', () => {
  it('should parse valid JSON', async () => {
    const json = { name: 'test', value: 123 }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseJson(request)
    expect(result).toEqual(json)
  })

  it('should reject invalid JSON', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: '{ invalid json }',
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(parseJson(request)).rejects.toThrow('Invalid JSON')
  })

  it('should reject oversized payload (content-length header) - fails quickly', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: 'x'.repeat(2 * 1024 * 1024), // 2MB body
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024), // 2MB in header
      },
    })

    await expect(parseJson(request, { maxBytes: 1024 * 1024 })).rejects.toThrow(
      PayloadTooLargeError
    )

    try {
      await parseJson(request, { maxBytes: 1024 * 1024 })
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadTooLargeError)
      if (error instanceof PayloadTooLargeError) {
        expect(error.actualBytes).toBe(2 * 1024 * 1024)
        expect(error.maxBytes).toBe(1024 * 1024)
        expect(error.message).toContain('Content-Length header exceeds limit')
      }
    }
  })

  it('should reject oversized payload (actual body size)', async () => {
    const largeJson = { data: 'x'.repeat(2 * 1024 * 1024) } // 2MB
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(largeJson),
      headers: { 'Content-Type': 'application/json' },
      // No Content-Length header - will read body to check
    })

    try {
      await parseJson(request, { maxBytes: 1024 * 1024 })
      expect.fail('Should have thrown PayloadTooLargeError')
    } catch (error) {
      expect(error).toBeInstanceOf(PayloadTooLargeError)
      if (error instanceof PayloadTooLargeError) {
        expect(error.actualBytes).toBeGreaterThan(error.maxBytes)
      }
    }
  })

  it('should accept payload within size limit', async () => {
    const json = { data: 'x'.repeat(512 * 1024) } // 512KB
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseJson(request, { maxBytes: 1024 * 1024 }) // 1MB limit
    expect(result).toBeDefined()
    expect(result).toEqual(json)
  })

  it('should use default maxBytes if not specified', async () => {
    const json = { data: 'x'.repeat(DEFAULT_MAX_JSON_BYTES + 1) }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(parseJson(request)).rejects.toThrow(PayloadTooLargeError)
  })

  it('should fail quickly when Content-Length exceeds limit (does not read body)', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: 'x'.repeat(10 * 1024 * 1024), // 10MB body
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(10 * 1024 * 1024), // 10MB in header
      },
    })

    const startTime = Date.now()
    await expect(parseJson(request, { maxBytes: 1024 * 1024 })).rejects.toThrow(
      PayloadTooLargeError
    )
    const endTime = Date.now()

    // Should fail quickly (within 100ms) since we check Content-Length first
    // If we were reading the 10MB body, it would take much longer
    expect(endTime - startTime).toBeLessThan(100)
  })
})

describe('validateBody', () => {
  const TestSchema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive(),
  })

  it('should validate valid body', async () => {
    const json = { name: 'test', age: 25 }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await validateBody(request, TestSchema)
    expect(result).toEqual(json)
  })

  it('should reject invalid body (missing field)', async () => {
    const json = { name: 'test' } // missing age
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(validateBody(request, TestSchema)).rejects.toThrow(z.ZodError)
  })

  it('should reject invalid body (wrong type)', async () => {
    const json = { name: 'test', age: 'not-a-number' }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    await expect(validateBody(request, TestSchema)).rejects.toThrow(z.ZodError)
  })

  it('should respect maxBytes option', async () => {
    const largeJson = { name: 'test', age: 25, data: 'x'.repeat(2 * 1024 * 1024) }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(largeJson),
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024),
      },
    })

    await expect(
      validateBody(request, TestSchema, { maxBytes: 1024 * 1024 })
    ).rejects.toThrow(PayloadTooLargeError)
  })
})

describe('validateQuery', () => {
  const QuerySchema = z.object({
    page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
    search: z.string().optional(),
  })

  it('should validate query parameters', async () => {
    const request = new NextRequest('http://localhost/api/test?page=2&limit=10&search=test')
    const result = await validateQuery(request, QuerySchema)

    expect(result.page).toBe(2)
    expect(result.limit).toBe(10)
    expect(result.search).toBe('test')
  })

  it('should use defaults for missing parameters', async () => {
    const request = new NextRequest('http://localhost/api/test')
    const result = await validateQuery(request, QuerySchema)

    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.search).toBeUndefined()
  })

  it('should handle multiple values for same key', async () => {
    const MultiSchema = z.object({
      tags: z.union([z.string(), z.array(z.string())]),
    })

    const request = new NextRequest('http://localhost/api/test?tags=tag1&tags=tag2')
    const result = await validateQuery(request, MultiSchema)

    expect(typeof result.tags === 'string' || Array.isArray(result.tags)).toBe(true)
  })
})

describe('validationError', () => {
  it('should format PayloadTooLargeError with 413 status', async () => {
    const error = new PayloadTooLargeError(2 * 1024 * 1024, 1024 * 1024)
    const response = validationError(error)

    expect(response.status).toBe(413)

    const body = await response.json()
    expect(body).toHaveProperty('ok', false)
    expect(body).toHaveProperty('error')
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const errorObj = body.error as { code: string; message: string }
      expect(errorObj.code).toBe(ErrorCode.PAYLOAD_TOO_LARGE)
      expect(errorObj.message).toBe('Request payload too large')
    }
  })

  it('should format ZodError correctly', async () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number(),
    })

    try {
      schema.parse({ name: '', age: 'not-a-number' })
      expect.fail('Should have thrown ZodError')
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response = validationError(error)
        expect(response.status).toBe(400)

        const body = await response.json()
        expect(body).toHaveProperty('ok', false)
        expect(body).toHaveProperty('error')
        if (typeof body === 'object' && body !== null && 'error' in body) {
          const errorObj = body.error as { code: string; details: unknown }
          expect(errorObj.code).toBe(ErrorCode.VALIDATION_ERROR)
          expect(Array.isArray(errorObj.details)).toBe(true)
        }
      }
    }
  })

  it('should handle generic Error', async () => {
    const error = new Error('Custom validation error')
    const response = validationError(error)

    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body).toHaveProperty('ok', false)
    expect(body).toHaveProperty('error')
    if (typeof body === 'object' && body !== null && 'error' in body) {
      const errorObj = body.error as { code: string; message: string }
      expect(errorObj.code).toBe(ErrorCode.VALIDATION_ERROR)
      expect(errorObj.message).toBe('Custom validation error')
    }
  })
})
