import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, ErrorCode, createCookieBridge, asHttpError } from '@/lib/api/http'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { ingestRealTriggerEvents } from '@/lib/services/triggerEvents'
import { serverEnv } from '@/lib/env'

export const dynamic = 'force-dynamic'

const IngestBodySchema = z
  .object({
    companyDomain: z.string().trim().min(1).optional(),
    companyName: z.string().trim().min(1).optional(),
  })
  .optional()

export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const provided = request.headers.get('x-cron-secret')
      const expected = serverEnv.TRIGGER_EVENTS_CRON_SECRET
      if (!expected || !provided || provided !== expected) {
        return fail(ErrorCode.UNAUTHORIZED, 'Unauthorized', undefined, undefined, bridge, requestId)
      }

      const payload = (body ?? null) as z.infer<typeof IngestBodySchema>
      const companyDomain = payload?.companyDomain ?? null
      const companyName = payload?.companyName ?? null

      // Minimal scaffolding: if no targeting info is provided, noop for now.
      if (!companyDomain && !companyName) {
        return ok({ message: 'noop' }, undefined, bridge, requestId)
      }

      const supabase = createSupabaseAdminClient()

      // Find leads matching the requested company (lightweight; no pagination yet).
      let query = supabase
        .from('leads')
        .select('id, user_id, company_name, company_domain')
        .limit(50)

      if (companyDomain) query = query.eq('company_domain', companyDomain)
      if (companyName) query = query.eq('company_name', companyName)

      const { data: leads, error } = await query
      if (error) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to query leads', { message: error.message }, undefined, bridge, requestId)
      }

      let totalCreated = 0
      for (const lead of leads ?? []) {
        const created = await ingestRealTriggerEvents({
          userId: lead.user_id,
          leadId: lead.id ?? null,
          companyName: lead.company_name ?? null,
          companyDomain: lead.company_domain ?? null,
        })
        totalCreated += created.created
      }

      return ok({ leadsProcessed: (leads ?? []).length, created: totalCreated }, undefined, bridge, requestId)
    } catch (err) {
      return asHttpError(err, '/api/trigger-events/ingest', undefined, bridge, requestId)
    }
  },
  { bodySchema: IngestBodySchema }
)

