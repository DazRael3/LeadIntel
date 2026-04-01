import { normalizeRoute } from './url.ts'

function stripCdata(s: string): string {
  return s.replace('<![CDATA[', '').replace(']]>', '')
}

export async function fetchSitemapRoutes(args: {
  baseUrl: string
  maxUrls: number
  timeoutMs: number
}): Promise<{ ok: true; routes: string[]; source: string } | { ok: false; error: string }> {
  const target = new URL('/sitemap.xml', args.baseUrl).toString()
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), Math.max(1_000, args.timeoutMs))
    const res = await fetch(target, { method: 'GET', signal: controller.signal })
    clearTimeout(t)
    if (!res.ok) return { ok: false, error: `sitemap_fetch_failed_http_${res.status}` }
    const text = await res.text()
    if (!text || !text.includes('<')) return { ok: false, error: 'sitemap_empty' }

    // Minimal parsing: extract <loc>...</loc> from both sitemapindex and urlset.
    const locs: string[] = []
    const re = /<loc>([\s\S]*?)<\/loc>/gi
    let m: RegExpExecArray | null = null
    while ((m = re.exec(text))) {
      const raw = stripCdata(String(m[1] ?? '')).trim()
      if (!raw) continue
      locs.push(raw)
      if (locs.length >= args.maxUrls) break
    }
    if (locs.length === 0) return { ok: false, error: 'sitemap_no_locs' }

    const routes: string[] = []
    for (const loc of locs) {
      const r = normalizeRoute(loc, args.baseUrl)
      if (r) routes.push(r)
      if (routes.length >= args.maxUrls) break
    }
    return { ok: true, routes: Array.from(new Set(routes)), source: '/sitemap.xml' }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: `sitemap_fetch_failed:${msg}` }
  }
}

