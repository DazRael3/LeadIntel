import { test, expect } from './fixtures'

test.describe('Health', () => {
  test('should return health status envelope', async ({ page }) => {
    const res = await page.request.get('/api/health', { failOnStatusCode: false })
    expect(res.status()).toBe(200)
    const json = await res.json()
    expect(json).toHaveProperty('ok', true)
    expect(json.data).toHaveProperty('status')
    expect(['ok', 'degraded', 'down']).toContain(json.data.status)
    expect(json.data).toHaveProperty('components')
  })
})

