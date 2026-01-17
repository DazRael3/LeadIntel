import { fail, ErrorCode } from '@/lib/api/http'

// Legacy endpoint. Use POST /api/checkout instead.
export async function GET() {
  return fail(
    ErrorCode.INTERNAL_ERROR,
    'Deprecated endpoint. Use POST /api/checkout',
    undefined,
    { status: 410 },
    undefined
  )
}
