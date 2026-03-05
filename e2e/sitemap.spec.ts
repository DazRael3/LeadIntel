import { test, expect } from './fixtures'

test.describe('Sitemap', () => {
  test('should return valid sitemap XML', async ({ page }) => {
    const res = await page.request.get('/sitemap.xml', { failOnStatusCode: false })
    expect(res.status()).toBe(200)

    const ct = res.headers()['content-type'] ?? ''
    expect(ct).toContain('application/xml')

    const xml = await res.text()
    expect(xml).toContain('<?xml')
    expect(xml).toContain('<urlset')
    expect(xml).toContain('<loc>https://dazrael.com/templates</loc>')
    // Ensure template detail pages are included.
    expect(xml).toContain('<loc>https://dazrael.com/templates/funding-email-1-short</loc>')
  })
})

