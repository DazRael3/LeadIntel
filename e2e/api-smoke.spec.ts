/**
 * API Smoke Tests
 * 
 * E2E tests that verify authenticated API endpoints work correctly,
 * including rate limiting and payload size validation.
 */

import { test, expect } from './fixtures'

test.describe('API Smoke Tests', () => {
  test('should authenticate and call /api/plan successfully', async ({ authenticatedPage }) => {
    // Make authenticated API call to /api/plan
    const response = await authenticatedPage.request.get('/api/plan', {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Verify response status
    expect(response.status()).toBe(200)

    // Verify response envelope structure
    const responseBody = await response.json()
    
    expect(responseBody).toHaveProperty('ok')
    
    if (responseBody.ok === true) {
      // Success response
      expect(responseBody).toHaveProperty('data')
      // Plan endpoint should return plan data
      if (responseBody.data) {
        expect(responseBody.data).toHaveProperty('plan')
      }
    } else {
      // Error response should have error object
      expect(responseBody).toHaveProperty('error')
      expect(responseBody.error).toHaveProperty('code')
      expect(responseBody.error).toHaveProperty('message')
    }
  })

  test('should enforce rate limiting and return 429', async ({ authenticatedPage }) => {
    // Keep this test deterministic + dev-server-friendly:
    // In E2E, `/api/whoami` is capped so we hit 429 within a small number of requests.
    let rateLimitResponse: import('@playwright/test').APIResponse | null = null

    for (let i = 0; i < 50; i++) {
      const res = await authenticatedPage.request.get('/api/whoami', {
        headers: { 'Content-Type': 'application/json' },
        failOnStatusCode: false,
      })
      if (res.status() === 429) {
        rateLimitResponse = res
        break
      }
    }

    expect(rateLimitResponse).not.toBeNull()

    if (rateLimitResponse) {
      const responseBody = await rateLimitResponse.json()
      expect(responseBody).toHaveProperty('ok', false)
      expect(responseBody).toHaveProperty('error')
      expect(responseBody.error).toHaveProperty('code', 'RATE_LIMIT_EXCEEDED')

      const headers = rateLimitResponse.headers()
      expect(headers).toHaveProperty('x-ratelimit-limit')
      expect(headers).toHaveProperty('x-ratelimit-remaining')
      expect(headers).toHaveProperty('retry-after')
    }
  })

  test('should enforce payload size limit and return 413', async ({ authenticatedPage }) => {
    // Use an endpoint that accepts POST with body validation
    // We'll use /api/generate-pitch which has maxBytes: 65536 (64KB)
    
    // Create a payload that exceeds the limit
    const maxBytes = 65536 // 64KB limit for generate-pitch
    const oversizedPayload = {
      companyUrl: 'https://example.com',
      data: 'x'.repeat(maxBytes + 1), // Exceed limit by 1 byte
    }

    // Mock OpenAI to avoid actual API calls
    await authenticatedPage.route('https://api.openai.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ choices: [{ message: { content: 'Mock response' } }] }),
      })
    })

    // Send oversized request
    const response = await authenticatedPage.request.post('/api/generate-pitch', {
      data: oversizedPayload,
      headers: {
        'Content-Type': 'application/json',
      },
      failOnStatusCode: false, // Don't fail on 413
    })

    // Verify we got 413 Payload Too Large
    expect(response.status()).toBe(413)

    // Verify 413 response format
    const responseBody = await response.json()
    expect(responseBody).toHaveProperty('ok', false)
    expect(responseBody).toHaveProperty('error')
    expect(responseBody.error).toHaveProperty('code', 'PAYLOAD_TOO_LARGE')
    expect(responseBody.error).toHaveProperty('message')
    expect(responseBody.error).toHaveProperty('details')
    
    // Verify details include size information
    if (responseBody.error.details && typeof responseBody.error.details === 'object') {
      const details = responseBody.error.details as { actualBytes?: number; maxBytes?: number }
      expect(details).toHaveProperty('actualBytes')
      expect(details).toHaveProperty('maxBytes')
      expect(details.actualBytes).toBeGreaterThan(details.maxBytes || 0)
    }
  })
})
