import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { refreshCompanySources } from '@/lib/sources/orchestrate'

const BodySchema = z.object({
  company_name: z.string().trim().min(1).max(120),
  company_domain: z.string().trim().min(1).max(120).nullable().optional(),
  input_url: z.string().trim().url().nullable().optional(),
  force: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export const POST = withApiGuard(
  async (request, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      const data = body as z.infer<typeof BodySchema>

      const res = await refreshCompanySources({
        companyName: data.company_name,
        companyDomain: data.company_domain ?? null,
        inputUrl: data.input_url ?? null,
        force: Boolean(data.force),
      })
      if (!res.ok) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to refresh sources', { errorCode: res.errorCode }, undefined, bridge, requestId)
      }
      return ok({ company_key: res.data.companyKey, ...res.data }, undefined, bridge, requestId)
    } catch (e) {
      return asHttpError(e, '/api/sources/refresh', userId, bridge, requestId)
    }
  },
  { bodySchema: BodySchema }
)

