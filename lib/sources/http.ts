export type FetchOk = {
  ok: true
  status: number
  url: string
  headers: Record<string, string>
  text: string
}

export type FetchErr = {
  ok: false
  status: number | null
  url: string
  errorCode: 'timeout' | 'network' | 'invalid_url' | 'http_error'
  message: string
  headers?: Record<string, string>
}

export type FetchResult = FetchOk | FetchErr

function headersToRecord(h: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  h.forEach((v, k) => {
    out[k.toLowerCase()] = v
  })
  return out
}

export function defaultUserAgent(): string {
  const fallback = 'LeadIntel (+https://raelinfo.com; leadintel@dazrael.com)'
  const raw = (process.env.SEC_USER_AGENT ?? '').trim()
  if (raw) return raw
  // Keep a consistent UA for all sources (SEC strongly prefers explicit UA).
  return fallback
}

export async function fetchText(args: {
  url: string
  timeoutMs: number
  headers?: Record<string, string | undefined>
  method?: 'GET' | 'POST'
  body?: string
}): Promise<FetchResult> {
  const { url, timeoutMs } = args
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { ok: false, status: null, url, errorCode: 'invalid_url', message: 'Invalid URL' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(u.toString(), {
      method: args.method ?? 'GET',
      headers: {
        'user-agent': defaultUserAgent(),
        ...(args.headers ?? {}),
      },
      body: args.body,
      signal: controller.signal,
      // Do not send cookies to third parties.
      credentials: 'omit',
      redirect: 'follow',
    })
    const text = await res.text()
    const headers = headersToRecord(res.headers)
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        url: u.toString(),
        errorCode: 'http_error',
        message: `HTTP ${res.status}`,
        headers,
      }
    }
    return { ok: true, status: res.status, url: u.toString(), headers, text }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const isTimeout = msg.toLowerCase().includes('aborted') || msg.toLowerCase().includes('timeout')
    return { ok: false, status: null, url: u.toString(), errorCode: isTimeout ? 'timeout' : 'network', message: msg }
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchJson<T>(args: {
  url: string
  timeoutMs: number
  headers?: Record<string, string | undefined>
  method?: 'GET' | 'POST'
  body?: unknown
}): Promise<{ ok: true; status: number; url: string; headers: Record<string, string>; json: T } | FetchErr> {
  const body = args.body !== undefined ? JSON.stringify(args.body) : undefined
  const res = await fetchText({
    url: args.url,
    timeoutMs: args.timeoutMs,
    method: args.method ?? 'GET',
    body,
    headers: {
      ...(args.body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(args.headers ?? {}),
    },
  })
  if (!res.ok) return res
  try {
    const json = JSON.parse(res.text) as T
    return { ok: true, status: res.status, url: res.url, headers: res.headers, json }
  } catch (e) {
    return {
      ok: false,
      status: res.status,
      url: res.url,
      errorCode: 'network',
      message: e instanceof Error ? e.message : 'Invalid JSON',
      headers: res.headers,
    }
  }
}

