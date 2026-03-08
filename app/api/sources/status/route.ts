import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { ok, fail, asHttpError, createCookieBridge, ErrorCode } from '@/lib/api/http'
import { normalizeCompanyKey } from '@/lib/sources/normalize'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { SourceType } from '@/lib/sources/normalize'

const QuerySchema = z.object({
  company_key: z.string().trim().min(1).optional(),
  company_name: z.string().trim().min(1).optional(),
  company_domain: z.string().trim().min(1).optional(),
  input_url: z.string().trim().optional(),
})

export const dynamic = 'force-dynamic'

type SnapshotStatus = { status: 'ok' | 'error'; fetched_at: string; expires_at: string; citations_count: number }

export const GET = withApiGuard(
  async (request, { query, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      if (!userId) return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)

      const q = query as z.infer<typeof QuerySchema>
      const companyKey =
        q.company_key?.trim() ||
        normalizeCompanyKey({
          companyName: q.company_name ?? 'Unknown',
          companyDomain: q.company_domain ?? null,
          inputUrl: q.input_url ?? null,
        }).companyKey

      const admin = createSupabaseAdminClient({ schema: 'api' })
      const { data, error } = await admin
        .from('company_source_snapshots')
        .select('source_type, status, fetched_at, expires_at, citations')
        .eq('company_key', companyKey)
        .order('fetched_at', { ascending: false })
        .limit(50)

      if (error) return fail(ErrorCode.DATABASE_ERROR, 'Failed to load source status', { message: error.message }, undefined, bridge, requestId)

      const latestByType = new Map<SourceType, SnapshotStatus>()
      for (const row of (data ?? []) as Array<{ source_type: SourceType; status: 'ok' | 'error'; fetched_at: string; expires_at: string; citations: unknown }>) {
        if (latestByType.has(row.source_type)) continue
        const citationsCount = Array.isArray(row.citations) ? row.citations.length : 0
        latestByType.set(row.source_type, {
          status: row.status,
          fetched_at: row.fetched_at,
          expires_at: row.expires_at,
          citations_count: citationsCount,
        })
      }

      return ok(
        {
          company_key: companyKey,
          sources: Object.fromEntries(Array.from(latestByType.entries()).map(([k, v]) => [k, v])),
        },
        undefined,
        bridge,
        requestId
      )
    } catch (e) {
      return asHttpError(e, '/api/sources/status', userId, bridge, requestId)
    }
  },
  { querySchema: QuerySchema }
)

