export type PlatformClientOptions = {
  baseUrl: string
  apiKey: string
}

export type PlatformEnvelope<T> =
  | { ok: true; data: T }
  | {
      ok: false
      error: {
        code: string
        message: string
        details?: unknown
        requestId?: string
      }
    }

