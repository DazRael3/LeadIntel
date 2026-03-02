import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, ErrorCode } from '@/lib/api/http'
import { generateDemoTryResult } from '@/lib/demo/tryLeadIntel'

const BodySchema = z.object({
  company: z.string().trim().min(1).max(80),
  icp: z.string().trim().max(200).optional().nullable(),
})

export const POST = withApiGuard(
  async (_request: NextRequest, { body, requestId }) => {
    try {
      const parsed = BodySchema.safeParse(body)
      if (!parsed.success) {
        return fail(
          ErrorCode.VALIDATION_ERROR,
          'Invalid demo request',
          parsed.error.flatten(),
          { status: 422 },
          undefined,
          requestId
        )
      }

      const result = generateDemoTryResult({ company: parsed.data.company, icp: parsed.data.icp ?? null })
      return ok(result, undefined, undefined, requestId)
    } catch (error) {
      return asHttpError(error, '/api/demo/try', undefined, undefined, requestId)
    }
  },
  { bodySchema: BodySchema }
)

