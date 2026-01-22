import { NextRequest, NextResponse } from 'next/server'
import { serverEnv } from '@/lib/env'
import { ok, fail, ErrorCode } from '@/lib/api/http'
import { withApiGuard } from '@/lib/api/guard'
import { z } from 'zod'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Intent Tracker API
 * Tracks website visitors and identifies companies using Clearbit Reveal API
 * Users embed this script on their website to track visitor IPs
 */

interface VisitorData {
  ip: string
  user_agent?: string
  referer?: string
  timestamp: string
  company_name?: string
  company_domain?: string
  company_industry?: string
}

const TrackerPostSchema = z.object({
  trackerKey: z.string().uuid('Invalid tracker key'),
  user_agent: z.string().optional(),
  referer: z.string().optional(),
  url: z.string().url().optional(),
  timestamp: z.string().optional(),
})

/**
 * GET: Return tracking script for embedding
 */
export async function GET(request: NextRequest) {
  const trackerKey = request.nextUrl.searchParams.get('k') || ''
  const script = `
(function() {
  // LeadIntel Intent Tracker
  const trackerUrl = '${request.nextUrl.origin}/api/tracker';
  const trackerKey = '${trackerKey.replace(/'/g, "\\'")}';
  if (!trackerKey) {
    console.warn('[LeadIntel Tracker] Missing tracker key. Use /api/tracker?k=YOUR_KEY');
    return;
  }
  
  // Get visitor IP and metadata
  fetch(trackerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trackerKey: trackerKey,
      user_agent: navigator.userAgent,
      referer: document.referrer,
      url: window.location.href,
      timestamp: new Date().toISOString()
    })
  }).catch(function(err) {
    console.error('Tracker error:', err);
  });
})();
`
  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

/**
 * POST: Receive visitor data and identify company
 */
export const POST = withApiGuard(
  async (request: NextRequest, { body, requestId }) => {
    try {
      const parsed = TrackerPostSchema.safeParse(body)
      if (!parsed.success) {
        return fail(ErrorCode.VALIDATION_ERROR, 'Validation failed', parsed.error.flatten(), undefined, undefined, requestId)
      }

      const clientIp =
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        'unknown'

      // Identify company using Clearbit Reveal API (best-effort)
      const companyData = await identifyCompany(clientIp)

      const visitorData: VisitorData = {
        ip: clientIp,
        user_agent: parsed.data.user_agent,
        referer: parsed.data.referer,
        timestamp: parsed.data.timestamp || new Date().toISOString(),
        company_name: companyData.name,
        company_domain: companyData.domain,
        company_industry: companyData.industry,
      }

      // Tenant resolution via tracker key (server-side, service role)
      const supabaseAdmin = createSupabaseAdminClient()
      const { data: settings, error: settingsError } = await supabaseAdmin
        .from('user_settings')
        .select('user_id')
        .eq('tracker_key', parsed.data.trackerKey)
        .maybeSingle()

      if (settingsError || !settings?.user_id) {
        return fail(ErrorCode.UNAUTHORIZED, 'Invalid tracker key', undefined, undefined, undefined, requestId)
      }

      const { error: insertError } = await supabaseAdmin.from('website_visitors').insert({
        user_id: settings.user_id,
        ip_address: visitorData.ip,
        company_name: visitorData.company_name,
        company_domain: visitorData.company_domain,
        company_industry: visitorData.company_industry,
        visited_at: visitorData.timestamp,
      })

      if (insertError) {
        return fail(ErrorCode.DATABASE_ERROR, 'Failed to write visitor', undefined, undefined, undefined, requestId)
      }

      return ok(
        {
          tracked: true,
          company: companyData.name || 'Unknown',
          domain: companyData.domain,
          industry: companyData.industry,
        },
        undefined,
        undefined,
        requestId
      )
    } catch {
      return fail(ErrorCode.INTERNAL_ERROR, 'Failed to track visitor', undefined, undefined, undefined, requestId)
    }
  },
  {
    bodySchema: TrackerPostSchema,
  }
)

/**
 * Identify company from IP using Clearbit Reveal API
 * PLACEHOLDER: Replace with actual Clearbit Reveal integration
 */
async function identifyCompany(ip: string): Promise<{
  name?: string
  domain?: string
  industry?: string
}> {
  const clearbitKey = serverEnv.CLEARBIT_REVEAL_API_KEY
  if (!clearbitKey) {
    // Return placeholder data
    return {
      name: 'Unknown Company',
      domain: undefined,
      industry: undefined,
    }
  }

  try {
    // PLACEHOLDER: Actual Clearbit Reveal API call
    // const response = await fetch(`https://reveal.clearbit.com/v1/companies/find?ip=${ip}`, {
    //   headers: {
    //     'Authorization': `Bearer ${CLEARBIT_REVEAL_API_KEY}`,
    //   },
    // })
    // const data = await response.json()
    // return {
    //   name: data.name,
    //   domain: data.domain,
    //   industry: data.category?.industry,
    // }

    // For now, return unknown if API key not configured
    return {
      name: 'Unknown Company',
      domain: undefined,
      industry: undefined,
    }
  } catch (error) {
    console.error('Error identifying company:', error)
    return {
      name: 'Unknown Company',
      domain: undefined,
      industry: undefined,
    }
  }
}
