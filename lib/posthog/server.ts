export type PostHogApiConfig = {
  host: string
  projectId: string
  personalApiKey: string
}

export function getPostHogApiConfig(): PostHogApiConfig | null {
  const host = (process.env.POSTHOG_HOST ?? 'https://app.posthog.com').trim()
  const projectId = (process.env.POSTHOG_PROJECT_ID ?? '').trim()
  const personalApiKey = (process.env.POSTHOG_PERSONAL_API_KEY ?? '').trim()
  if (!projectId || !personalApiKey) return null
  return { host: host.replace(/\/$/, ''), projectId, personalApiKey }
}

type HogQLQueryResponse = {
  results?: unknown
  error?: string
}

export async function queryHogQL(args: { config: PostHogApiConfig; query: string }): Promise<number> {
  // Keep queries low-risk: only return first scalar cell as a number.
  const url = `${args.config.host}/api/projects/${encodeURIComponent(args.config.projectId)}/query/`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.config.personalApiKey}`,
    },
    body: JSON.stringify({
      query: { kind: 'HogQLQuery', query: args.query },
    }),
  })
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

