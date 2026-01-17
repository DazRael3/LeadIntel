/**
 * Request Validation Utilities Tests
 * 
 * Tests for validate.ts helpers including oversized payload and invalid JSON scenarios.
 * 
 * Run with: npx tsx lib/api/validate.test.ts
 * Or with Node.js test runner: node --test lib/api/validate.test.ts
 */

import { strict as assert } from 'assert'
import { describe, it } from 'node:test'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { parseJson, validateBody, validateQuery, validationError, DEFAULT_MAX_JSON_BYTES, PayloadTooLargeError } from './validate'
import { NextResponse } from 'next/server'

describe('parseJson', () => {
  it('should parse valid JSON', async () => {
    const json = { name: 'test', value: 123 }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseJson(request)
    assert.deepStrictEqual(result, json)
  })

  it('should reject invalid JSON', async () => {
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: '{ invalid json }',
      headers: { 'Content-Type': 'application/json' },
    })

    await assert.rejects(
      async () => await parseJson(request),
      (error: Error) => error.message.includes('Invalid JSON')
    )
  })

  it('should reject oversized payload (content-length header) - fails quickly', async () => {
    // Create a request with Content-Length header exceeding limit
    // This should fail WITHOUT reading the body
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: 'x'.repeat(2 * 1024 * 1024), // 2MB body
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(2 * 1024 * 1024), // 2MB in header
      },
    })

    await assert.rejects(
      async () => await parseJson(request, { maxBytes: 1024 * 1024 }), // 1MB limit
      (error) => {
        // Should be PayloadTooLargeError
        assert.ok(error instanceof PayloadTooLargeError)
        assert.strictEqual(error.actualBytes, 2 * 1024 * 1024)
        assert.strictEqual(error.maxBytes, 1024 * 1024)
        assert.ok(error.message.includes('Content-Length header exceeds limit'))
        return true
      }
    )
  })

  it('should reject oversized payload (actual body size)', async () => {
    const largeJson = { data: 'x'.repeat(2 * 1024 * 1024) } // 2MB
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(largeJson),
      headers: { 'Content-Type': 'application/json' },
      // No Content-Length header - will read body to check
    })

    await assert.rejects(
      async () => await parseJson(request, { maxBytes: 1024 * 1024 }), // 1MB limit
      (error) => {
        assert.ok(error instanceof PayloadTooLargeError)
        assert.ok(error.actualBytes > error.maxBytes)
        return true
      }
    )
  })

  it('should accept payload within size limit', async () => {
    const json = { data: 'x'.repeat(512 * 1024) } // 512KB
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    const result = await parseJson(request, { maxBytes: 1024 * 1024 }) // 1MB limit
    assert.ok(result)
    assert.deepStrictEqual(result, json)
  })

  it('should use default maxBytes if not specified', async () => {
    const json = { data: 'x'.repeat(DEFAULT_MAX_JSON_BYTES + 1) }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    await assert.rejects(
      async () => await parseJson(request),
      (error) => {
        assert.ok(error instanceof PayloadTooLargeError)
        return true
      }
    )
  })

  it('should fail quickly when Content-Length exceeds limit (does not read body)', async () => {
    // This test verifies that we check Content-Length BEFORE reading body
    // In a real scenario, this prevents reading large bodies into memory
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: 'x'.repeat(10 * 1024 * 1024), // 10MB body
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': String(10 * 1024 * 1024), // 10MB in header
      },
    })

    const startTime = Date.now()
    await assert.rejects(
      async () => await parseJson(request, { maxBytes: 1024 * 1024 }), // 1MB limit
      (error) => {
        assert.ok(error instanceof PayloadTooLargeError)
        return true
      }
    )
    const endTime = Date.now()
    
    // Should fail quickly (within 100ms) since we check Content-Length first
    // If we were reading the 10MB body, it would take much longer
    assert.ok(endTime - startTime < 100, 'Should fail quickly without reading large body')
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
    assert.deepStrictEqual(result, json)
  })

  it('should reject invalid body (missing field)', async () => {
    const json = { name: 'test' } // missing age
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    await assert.rejects(
      async () => await validateBody(request, TestSchema),
      (error) => error instanceof z.ZodError
    )
  })

  it('should reject invalid body (wrong type)', async () => {
    const json = { name: 'test', age: 'not-a-number' }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(json),
      headers: { 'Content-Type': 'application/json' },
    })

    await assert.rejects(
      async () => await validateBody(request, TestSchema),
      (error) => error instanceof z.ZodError
    )
  })

  it('should respect maxBytes option', async () => {
    const largeJson = { name: 'test', age: 25, data: 'x'.repeat(2 * 1024 * 1024) }
    const request = new NextRequest('http://localhost/api/test', {
      method: 'POST',
      body: JSON.stringify(largeJson),
      headers: { 'Content-Type': 'application/json' },
    })

    await assert.rejects(
      async () => await validateBody(request, TestSchema, { maxBytes: 1024 * 1024 }),
      (error: Error) => error.message.includes('too large')
    )
  })
})

describe('validateQuery', () => {
  const QuerySchema = z.object({
    page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
    limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 20),
    search: z.string().optional(),
  })

  it('should validate query parameters', async () => {
    const request = new NextRequest('http://localhost/api/test?page=2&limit=10&search=test')
    const result = await validateQuery(request, QuerySchema)
    
    assert.strictEqual(result.page, 2)
    assert.strictEqual(result.limit, 10)
    assert.strictEqual(result.search, 'test')
  })

  it('should use defaults for missing parameters', async () => {
    const request = new NextRequest('http://localhost/api/test')
    const result = await validateQuery(request, QuerySchema)
    
    assert.strictEqual(result.page, 1)
    assert.strictEqual(result.limit, 20)
    assert.strictEqual(result.search, undefined)
  })

  it('should handle multiple values for same key', async () => {
    const MultiSchema = z.object({
      tags: z.union([z.string(), z.array(z.string())]),
    })
    
    const request = new NextRequest('http://localhost/api/test?tags=tag1&tags=tag2')
    const result = await validateQuery(request, MultiSchema)
    
    assert.ok(Array.isArray(result.tags) || typeof result.tags === 'string')
  })
})

describe('validationError', () => {
  it('should format ZodError correctly', () => {
    const schema = z.object({
      name: z.string().min(1),
      age: z.number(),
    })

    try {
      schema.parse({ name: '', age: 'not-a-number' })
      assert.fail('Should have thrown ZodError')
    } catch (error) {
      if (error instanceof z.ZodError) {
        const response = validationError(error)
        // NextResponse body is a ReadableStream, so we need to handle it differently
        // For testing purposes, we'll check the response type
        assert.ok(response instanceof NextResponse)
        assert.strictEqual(response.status, 400)
      } else {
        assert.fail('Should have thrown ZodError')
      }
    }
  })

  it('should format PayloadTooLargeError with 413 status', () => {
    const error = new PayloadTooLargeError(2 * 1024 * 1024, 1024 * 1024)
    const response = validationError(error)
    
    assert.ok(response instanceof NextResponse)
    assert.strictEqual(response.status, 413)
  })

  it('should handle generic Error', () => {
    const error = new Error('Custom validation error')
    const response = validationError(error)
    
    assert.ok(response instanceof NextResponse)
    assert.strictEqual(response.status, 400)
  })
})
