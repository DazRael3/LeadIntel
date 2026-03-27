export function normalizeRoute(routeOrUrl: string, baseUrl: string): string | null {
  try {
    const u = new URL(routeOrUrl, baseUrl)
    const base = new URL(baseUrl)
    if (u.origin !== base.origin) return null
    const pathname = u.pathname || '/'
    const search = u.search || ''
    // Normalize trailing slash except root.
    const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
    // Strip obviously sensitive token-y params.
    const sp = new URLSearchParams(search)
    if (sp.has('token') || sp.has('access_token') || sp.has('refresh_token')) {
      return p
    }
    const qs = sp.toString()
    return qs ? `${p}?${qs}` : p
  } catch {
    return null
  }
}

