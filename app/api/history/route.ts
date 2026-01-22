import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { HistoryQuerySchema } from '@/lib/api/schemas'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'

export const dynamic = 'force-dynamic'

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100

// Extended schema with limit validation
const HistoryQueryWithLimitSchema = HistoryQuerySchema.extend({
  limit: z.string().optional().transform((val) => {
    const num = val ? parseInt(val, 10) : PAGE_SIZE_DEFAULT
    return Math.min(Math.max(1, num), PAGE_SIZE_MAX)
  }),
})

export async function GET(request: NextRequest) {
  return GET_GUARDED(request)
}

const GET_GUARDED = withApiGuard(
  async (request: NextRequest, { query, requestId }) => {
    const bridge = createCookieBridge()

    const q = (query as z.infer<typeof HistoryQueryWithLimitSchema>).q || ''
    const tag = (query as z.infer<typeof HistoryQueryWithLimitSchema>).tag || ''
    const limit = (query as z.infer<typeof HistoryQueryWithLimitSchema>).limit || PAGE_SIZE_DEFAULT
    const cursor = (query as z.infer<typeof HistoryQueryWithLimitSchema>).cursor

    const supabase = createRouteClient(request, bridge)

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

  let query = supabase
    .from('pitches')
    .select(`
      id,
      lead_id,
      content,
      created_at,
      leads:lead_id (
        company_name,
        company_domain,
        company_url
      ),
      lead_tags:lead_id (
        lead_id
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit + 1)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  if (q) {
    const ilike = `%${q}%`
    query = query.or(`content.ilike.${ilike},leads.company_name.ilike.${ilike},leads.company_domain.ilike.${ilike},leads.company_url.ilike.${ilike}`)
  }

  // Tag filter: tag name or id
  if (tag) {
    // First, get tag IDs matching the tag filter
    const { data: tagData } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', user.id)
      .or(`id.eq.${tag},name.ilike.${tag}`)
    
    if (!tagData || tagData.length === 0) {
      // No tags match, return empty result
      query = query.eq('lead_id', '00000000-0000-0000-0000-000000000000') // Impossible UUID
    } else {
      // Extract tag IDs as a plain array
      const tagIds: string[] = tagData.map((t: { id: string }) => String(t.id)).filter(Boolean)
      
      if (tagIds.length === 0) {
        query = query.eq('lead_id', '00000000-0000-0000-0000-000000000000') // Impossible UUID
      } else {
        // Then, get lead IDs that have these tags
        const { data: leadTagData } = await supabase
          .from('lead_tags')
          .select('lead_id')
          .eq('user_id', user.id)
          .in('tag_id', tagIds)
        
        if (!leadTagData || leadTagData.length === 0) {
          // No leads match this tag, return empty result
          query = query.eq('lead_id', '00000000-0000-0000-0000-000000000000') // Impossible UUID
        } else {
          // Extract lead IDs as a plain array
          const leadIds: string[] = leadTagData.map((lt: { lead_id: string }) => String(lt.lead_id)).filter(Boolean)
          
          if (leadIds.length === 0) {
            query = query.eq('lead_id', '00000000-0000-0000-0000-000000000000') // Impossible UUID
          } else {
            query = query.in('lead_id', leadIds)
          }
        }
      }
    }
  }

    const { data, error } = await query

    if (error) {
      return fail(ErrorCode.DATABASE_ERROR, 'Failed to fetch history', undefined, undefined, bridge, requestId)
    }

    const hasMore = data && data.length > limit
    const items = (data || []).slice(0, limit).map((row: any) => ({
      pitch_id: row.id,
      lead_id: row.lead_id,
      company_name: row.leads?.company_name || null,
      company_domain: row.leads?.company_domain || null,
      company_url: row.leads?.company_url || null,
      created_at: row.created_at,
      content: row.content,
      tags: [], // tags fetched separately via tags API
    }))

    const nextCursor = hasMore ? items[items.length - 1]?.created_at : null

      return ok({ items, nextCursor }, undefined, bridge, requestId)
    } catch (error) {
      return asHttpError(error, '/api/history', undefined, bridge, requestId)
    }
  },
  { querySchema: HistoryQueryWithLimitSchema }
)
