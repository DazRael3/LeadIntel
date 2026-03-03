import type { MetadataRoute } from 'next'
import { COMPARE_PAGES } from '@/lib/compare/registry'

const BASE_URL = 'https://dazrael.com'

const ROUTES: string[] = [
  '/',
  '/tour',
  '/compare',
  '/pricing',
  '/templates',
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
  const compareRoutes = COMPARE_PAGES.map((p) => `/compare/${p.slug}`)
  const all = [...ROUTES, ...compareRoutes]
  return all.map((path) => ({
    url: `${BASE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }))
}

