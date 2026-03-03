import type { MetadataRoute } from 'next'

const BASE_URL = 'https://dazrael.com'

const ROUTES: string[] = [
  '/',
  '/pricing',
  '/support',
  '/use-cases',
  '/use-cases/funding-outreach',
  '/use-cases/hiring-spike',
  '/use-cases/partnership-announcement',
  '/use-cases/product-launch-timing',
  '/use-cases/competitive-displacement',
  '/use-cases/expansion-signals',
  '/how-scoring-works',
  '/security',
  '/privacy',
  '/terms',
  '/acceptable-use',
  '/subprocessors',
  '/dpa',
  '/status',
  '/changelog',
  '/roadmap',
  '/sdr',
  '/ae',
  '/founder',
  '/agency',
  '/revops',
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return ROUTES.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }))
}

