export class PublicError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: unknown

  constructor(args: { code: string; message: string; status: number; details?: unknown }) {
    super(args.message)
    this.name = 'PublicError'
    this.code = args.code
    this.status = args.status
    this.details = args.details
  }
}

