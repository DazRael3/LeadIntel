import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { serverEnv } from '@/lib/env'
import { ok, fail, ErrorCode } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { z } from 'zod'

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

/**
 * GET: Return tracking script for embedding
 */
export async function GET(request: NextRequest) {
  const script = `
(function() {
  // LeadIntel Intent Tracker
  const trackerUrl = '${request.nextUrl.origin}/api/tracker';
  
  // Get visitor IP and metadata
  fetch(trackerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
export async function POST(request: NextRequest) {
  try {
    // Validate request body
    const TrackerPostSchema = z.object({
      user_agent: z.string().optional(),
      referer: z.string().optional(),
      url: z.string().url().optional(),
      timestamp: z.string().optional(),
    })
    
    let body
    try {
      body = await validateBody(request, TrackerPostSchema)
    } catch (error) {
      return validationError(error, undefined)
    }
    
    const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    // Identify company using Clearbit Reveal API
    const companyData = await identifyCompany(clientIp)

    const visitorData: VisitorData = {
      ip: clientIp,
      user_agent: body.user_agent,
      referer: body.referer,
      timestamp: body.timestamp || new Date().toISOString(),
      company_name: companyData.name,
      company_domain: companyData.domain,
      company_industry: companyData.industry,
    }

    // Save to database (create visitors table if needed)
    try {
      const supabase = createClient()
      await supabase
        .from('website_visitors')
        .insert({
          ip_address: visitorData.ip,
          user_agent: visitorData.user_agent,
          referer: visitorData.referer,
          company_name: visitorData.company_name,
          company_domain: visitorData.company_domain,
          company_industry: visitorData.company_industry,
          visited_at: visitorData.timestamp,
        })
    } catch (dbError) {
      // Table might not exist yet - log but don't fail
      console.log('Visitor tracking (table may need creation):', dbError)
    }

    return ok({
      ip: clientIp,
      company: companyData.name || 'Unknown',
      domain: companyData.domain,
      industry: companyData.industry,
    })
  } catch (error) {
    return fail(
      ErrorCode.INTERNAL_ERROR,
      'Failed to track visitor',
      undefined,
      undefined,
      undefined
    )
  }
}

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
    console.log('Clearbit Reveal API key not configured, using placeholder')
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
