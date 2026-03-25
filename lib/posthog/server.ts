export type PostHogApiConfig = {
  host: string
  projectId: string
  personalApiKey: string
}

function normalizePosthogHost(raw: string | undefined): string {
  const fallback = 'https://app.posthog.com'
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return fallback

  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  try {
    const url = new URL(withScheme)
    // origin has no trailing slash and strips any path/query/hash
    return url.origin
  } catch {
    return fallback
  }
}

export function getPostHogApiConfig(): PostHogApiConfig | null {
  const host = normalizePosthogHost(process.env.POSTHOG_HOST ?? process.env.NEXT_PUBLIC_POSTHOG_HOST)
  const projectId = (process.env.POSTHOG_PROJECT_ID ?? '').trim()
  const personalApiKey = (process.env.POSTHOG_PERSONAL_API_KEY ?? '').trim()
  if (!projectId || !personalApiKey) return null
  return { host, projectId, personalApiKey }
}

type HogQLQueryResponse = {
  results?: unknown
  error?: string
}

export async function queryHogQL(args: { config: PostHogApiConfig; query: string }): Promise<number> {
  // Keep queries low-risk: only return first scalar cell as a number.
  const projectId = encodeURIComponent(args.config.projectId)
  const base = `${args.config.host}/api/projects/${projectId}/query`
  const payload = JSON.stringify({ query: { kind: 'HogQLQuery', query: args.query } })

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${args.config.personalApiKey}`,
  } as const

  const attempt = async (url: string) =>
    await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
    })

  let res = await attempt(`${base}/`)
  if (res.status === 404) {
    // Some PostHog instances are strict about trailing slash.
    res = await attempt(base)
  }
  if (!res.ok) throw new Error(`posthog_query_failed_${res.status}`)
  const json = (await res.json()) as HogQLQueryResponse
  const results = json.results as unknown

  // PostHog returns results as { results: [[value]] } for HogQLQuery.
  if (Array.isArray(results) && Array.isArray(results[0]) && results[0].length > 0) {
    const v = results[0][0]
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : 0
  }

  return 0
}

export function isPosthogRateLimitedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : ''
  return /^posthog_query_failed_429$/.test(msg)
}

