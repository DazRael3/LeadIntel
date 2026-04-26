import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
<<<<<<< HEAD
<<<<<<< HEAD
  const raw = (process.env.APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'https://raelinfo.com').trim()
=======
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? 'https://raelinfo.com').trim()
>>>>>>> cursor/audit-access-instructions-aa8d
=======
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.APP_URL ?? 'https://raelinfo.com').trim()
>>>>>>> cursor/audit-access-instructions-aa8d
  const base = raw.length > 0 ? raw.replace(/\/+$/, '') : 'https://raelinfo.com'
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${base}/sitemap.xml`,
  }
}

