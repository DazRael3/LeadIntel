import type { MetadataRoute } from 'next'
import { COMPARE_PAGES } from '@/lib/compare/registry'
import { TEMPLATE_LIBRARY } from '@/lib/templates/registry'

const DEFAULT_BASE_URL = 'https://raelinfo.com'

// Always include these core routes (content audit depends on their presence).
const REQUIRED_ROUTES = [
  '/contact',
  '/pricing',
  '/support',
  '/tour',
  '/templates',
  '/compare',
  '/use-cases',
  '/how-scoring-works',
] as const

const ROUTES: string[] = [
  '/',
  '/tour',
  '/compare',
  '/pricing',
  '/templates',
  '/support',
  '/trust',
  '/version',
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

function baseUrl(): string {
  // Sitemap should always point at the canonical public host to avoid splitting SEO across apex/www.
  // Use NEXT_PUBLIC_SITE_URL or APP_URL only if they are set to the canonical apex host.
  const rawApp = (process.env.APP_URL ?? '').trim().replace(/\/$/, '')
  const rawSite = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().replace(/\/$/, '')
  const candidate = rawSite || rawApp || DEFAULT_BASE_URL
  return candidate.replace(/\/$/, '')
}

function normalizePath(p: string): string {
  const s = p.trim()
  if (!s) return '/'
  return s.startsWith('/') ? s : `/${s}`
}

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const compareRoutes = COMPARE_PAGES.map((p) => `/compare/${p.slug}`)
  const templateRoutes = TEMPLATE_LIBRARY.map((t) => `/templates/${t.slug}`)
  const all = Array.from(
    new Set([...REQUIRED_ROUTES, ...ROUTES, ...compareRoutes, ...templateRoutes].map((p) => normalizePath(p)))
  )
  const b = baseUrl()

  return all.map((path) => ({
    url: `${b}${path}`,
    lastModified: now,
    changeFrequency: path === '/' ? 'daily' : 'weekly',
    priority: path === '/' ? 1 : 0.7,
  }))
}

