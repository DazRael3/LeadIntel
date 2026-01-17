import { withApiGuard } from '@/lib/api/guard'
import { fail, ErrorCode } from '@/lib/api/http'

export const dynamic = 'force-dynamic'

// Legacy endpoint. Use /api/stripe/webhook instead.
export const POST = withApiGuard(
  async (request, { requestId }) => {
    return fail(
      ErrorCode.INTERNAL_ERROR,
      'Deprecated endpoint. Use /api/stripe/webhook',
      undefined,
      { status: 410 },
      undefined,
      requestId
    )
  }
)
