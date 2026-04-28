type SearchResultItem = {
  title: string
  url: string
  snippet: string
  source: 'tavily' | 'serpapi'
}

export type SearchProviderResult = {
  provider: 'tavily' | 'serpapi' | 'none'
  items: SearchResultItem[]
  errorCode?: 'SEARCH_UNAVAILABLE' | 'SEARCH_RATE_LIMITED' | 'SEARCH_PROVIDER_ERROR'
}

function envString(name: string): string {
  const raw = process.env[name]
  return typeof raw === 'string' ? raw.trim() : ''
}

function hasSensitiveInput(value: string): boolean {
  if (!value.trim()) return true
  if (/@/.test(value)) return true
  if (/\b(?:token|password|secret|cookie|session|auth)\b/i.test(value)) return true
  if (/\beyJ[A-Za-z0-9_-]{6,}\./.test(value)) return true
  return false
}

function sanitizeQuery(query: string): string {
  return query.replace(/\s+/g, ' ').trim().slice(0, 180)
}

async function searchWithTavily(query: string): Promise<SearchProviderResult> {
  const apiKey = envString('TAVILY_API_KEY')
  if (!apiKey) return { provider: 'none', items: [], errorCode: 'SEARCH_UNAVAILABLE' }

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        include_answer: false,
        max_results: 5,
      }),
    })
    if (response.status === 429) {
      return { provider: 'tavily', items: [], errorCode: 'SEARCH_RATE_LIMITED' }
    }
    if (!response.ok) {
      return { provider: 'tavily', items: [], errorCode: 'SEARCH_PROVIDER_ERROR' }
    }

    const payload = (await response.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>
    }
    const items = (payload.results ?? [])
      .map((item) => ({
        title: typeof item.title === 'string' ? item.title.trim() : '',
        url: typeof item.url === 'string' ? item.url.trim() : '',
        snippet: typeof item.content === 'string' ? item.content.trim() : '',
        source: 'tavily' as const,
      }))
      .filter((item) => item.title.length > 0 && item.url.startsWith('http'))
      .slice(0, 5)

    return { provider: 'tavily', items }
  } catch {
    return { provider: 'tavily', items: [], errorCode: 'SEARCH_PROVIDER_ERROR' }
  }
}

async function searchWithSerpApi(query: string): Promise<SearchProviderResult> {
  const apiKey = envString('SERPAPI_API_KEY')
  if (!apiKey) return { provider: 'none', items: [], errorCode: 'SEARCH_UNAVAILABLE' }

  try {
    const url = new URL('https://serpapi.com/search.json')
    url.searchParams.set('engine', 'google')
    url.searchParams.set('q', query)
    url.searchParams.set('api_key', apiKey)
    url.searchParams.set('num', '5')

    const response = await fetch(url.toString())
    if (response.status === 429) {
      return { provider: 'serpapi', items: [], errorCode: 'SEARCH_RATE_LIMITED' }
    }
    if (!response.ok) {
      return { provider: 'serpapi', items: [], errorCode: 'SEARCH_PROVIDER_ERROR' }
    }
    const payload = (await response.json()) as {
      organic_results?: Array<{ title?: string; link?: string; snippet?: string }>
    }

    const items = (payload.organic_results ?? [])
      .map((item) => ({
        title: typeof item.title === 'string' ? item.title.trim() : '',
        url: typeof item.link === 'string' ? item.link.trim() : '',
        snippet: typeof item.snippet === 'string' ? item.snippet.trim() : '',
        source: 'serpapi' as const,
      }))
      .filter((item) => item.title.length > 0 && item.url.startsWith('http'))
      .slice(0, 5)

    return { provider: 'serpapi', items }
  } catch {
    return { provider: 'serpapi', items: [], errorCode: 'SEARCH_PROVIDER_ERROR' }
  }
}

export async function searchPublicCompanyContext(
  rawQuery: string
): Promise<SearchProviderResult> {
  const query = sanitizeQuery(rawQuery)
  if (hasSensitiveInput(query)) {
    return { provider: 'none', items: [] }
  }
  if (!query) return { provider: 'none', items: [] }

  const tavily = await searchWithTavily(query)
  if (tavily.items.length > 0) return tavily
  if (tavily.errorCode === 'SEARCH_RATE_LIMITED') {
    // Fall through to SerpAPI when Tavily is rate-limited.
  } else if (tavily.provider === 'tavily' && tavily.errorCode === 'SEARCH_PROVIDER_ERROR') {
    // Fall through to SerpAPI on provider failure.
  } else if (tavily.provider === 'none') {
    // No Tavily key configured; continue.
  }

  const serp = await searchWithSerpApi(query)
  if (serp.items.length > 0) return serp
  if (serp.provider === 'serpapi') return serp
  return { provider: 'none', items: [] }
}
