import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { fail, ErrorCode } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { HistoryQuerySchema } from '@/lib/api/schemas'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export const GET = withApiGuard(
  async (request, { query: validatedQuery, userId, requestId }) => {
    const query = validatedQuery as z.infer<typeof HistoryQuerySchema>
    const q = query.q || ''
    const tag = query.tag || ''

    const response = NextResponse.next()
    const supabase = createRouteClient(request, response)
    
    // Guard already verified authentication, userId is guaranteed
    const user = { id: userId! }

    let dbQuery = supabase
    .from('pitches')
    .select(`
      content,
      created_at,
      leads:lead_id (
        company_name,
        company_domain,
        company_url
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (q) {
    const ilike = `%${q}%`
    dbQuery = dbQuery.or(`content.ilike.${ilike},leads.company_name.ilike.${ilike},leads.company_domain.ilike.${ilike},leads.company_url.ilike.${ilike}`)
  }

  if (tag) {
    // First, get tag IDs matching the tag filter
    const { data: tagData } = await supabase
      .from('tags')
      .select('id')
      .eq('user_id', user.id)
      .or(`id.eq.${tag},name.ilike.${tag}`)
    
    if (!tagData || tagData.length === 0) {
      // No tags match, return empty result
      dbQuery = dbQuery.eq('lead_id', '00000000-0000-0000-0000-000000000000') // Impossible UUID
    } else {
      // Extract tag IDs as a plain array
      const tagIds: string[] = tagData.map((t: { id: string }) => String(t.id)).filter(Boolean)
      
      if (tagIds.length === 0) {
        dbQuery = dbQuery.eq('lead_id', '00000000-0000-0000-0000-000000000000') // Impossible UUID
      } else {
        // Then, get lead IDs that have these tags
        const { data: leadTagData } = await supabase
          .from('lead_tags')
          .select('lead_id')
          .eq('user_id', user.id)
          .in('tag_id', tagIds)
      
        if (!leadTagData || leadTagData.length === 0) {
          // No leads match this tag, return empty result
          dbQuery = dbQuery.eq('lead_id', '00000000-0000-0000-0000-000000000000') // Impossible UUID
        } else {
          // Extract lead IDs as a plain array
          const leadIds: string[] = leadTagData.map((lt: { lead_id: string }) => String(lt.lead_id)).filter(Boolean)
          
          if (leadIds.length === 0) {
            dbQuery = dbQuery.eq('lead_id', '00000000-0000-0000-0000-000000000000') // Impossible UUID
          } else {
            dbQuery = dbQuery.in('lead_id', leadIds)
          }
        }
      }
    }
  }

  const { data, error } = await dbQuery
  if (error) {
    return fail(ErrorCode.DATABASE_ERROR, 'Failed to export history', undefined, undefined, undefined, requestId)
  }

  const rows = data || []
  const header = ['created_at', 'company_name', 'company_domain', 'company_url', 'pitch']
  const escape = (val: string) => {
    const needs = /[",\n]/.test(val)
    const safe = val.replace(/"/g, '""')
    return needs ? `"${safe}"` : safe
  }
  
  // Helper to extract lead data (handles both single object and array)
  const getLeadData = (leads: any) => {
    if (!leads) return { company_name: '', company_domain: '', company_url: '' }
    // Handle array case (if multiple leads somehow)
    if (Array.isArray(leads)) {
      return leads[0] || { company_name: '', company_domain: '', company_url: '' }
    }
    // Handle single object case
    return leads
  }
  
  const csvLines = [
    header.join(','),
    ...rows.map((r: any) => {
      const lead = getLeadData(r.leads)
      return [
        r.created_at || '',
        lead.company_name || '',
        lead.company_domain || '',
        lead.company_url || '',
        r.content || '',
      ].map(x => escape(String(x || ''))).join(',')
    })
  ]

  const csv = csvLines.join('\n')

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="pitch-history.csv"',
      },
    })
  },
  {
    querySchema: HistoryQuerySchema,
  }
)
