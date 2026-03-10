export class PlatformClientError extends Error {
  code: string
  requestId?: string
  details?: unknown

  constructor(args: { code: string; message: string; requestId?: string; details?: unknown }) {
    super(args.message)
    this.name = 'PlatformClientError'
    this.code = args.code
    this.requestId = args.requestId
    this.details = args.details
  }
}

