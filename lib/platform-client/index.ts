import type { PlatformClientOptions, PlatformEnvelope } from '@/lib/platform-client/types'
import { PlatformClientError } from '@/lib/platform-client/errors'

export class PlatformClient {
  private baseUrl: string
  private apiKey: string

  constructor(opts: PlatformClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/+$/, '')
    this.apiKey = opts.apiKey
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${this.apiKey}`,
        ...(init.headers ?? {}),
      },
    })
    const json = (await res.json().catch(() => null)) as PlatformEnvelope<T> | null
    if (!json) throw new PlatformClientError({ code: 'INVALID_RESPONSE', message: 'Invalid response from platform API.' })
    if (json.ok) return json.data
    throw new PlatformClientError({
      code: json.error.code ?? 'PLATFORM_ERROR',
      message: json.error.message ?? 'Platform request failed.',
      requestId: json.error.requestId,
      details: json.error.details,
    })
  }

  health(): Promise<{ status: 'ok'; version: 'v1' }> {
    return this.request('/api/v1/health')
  }

  workspace(): Promise<{ workspace: unknown }> {
    return this.request('/api/v1/workspace')
  }
}

