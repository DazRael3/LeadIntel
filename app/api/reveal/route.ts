import { NextRequest, NextResponse } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { serverEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { z } from 'zod'
import { withApiGuard } from '@/lib/api/guard'
import { assertFeatureEnabled } from '@/lib/services/feature-flags'
import { captureBreadcrumb } from '@/lib/observability/sentry'
import { isPro as isProPlan } from '@/lib/billing/plan'

/**
 * Ghost Reveal API
 * Identifies companies from visitor IP addresses using Clearbit Reveal API
 * Enterprise Intelligence feature for Pro users
 */

interface RevealResponse {
  companyName?: string
  companyDomain?: string
  companyIndustry?: string
  confidence: 'high' | 'medium' | 'low'
}

const RevealPostSchema = z.object({
  visitor_ip: z.string().ip('Invalid IP address format'),
})

/**
 * POST: Identify company from visitor IP
 */
export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const { visitor_ip } = body as z.infer<typeof RevealPostSchema>

      const supabase = createRouteClient(request, bridge)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const featureGate = await assertFeatureEnabled('clearbit_enrichment', {
        route: '/api/reveal',
        requestId,
        tenantId: user.id,
        mode: 'user',
        supabase,
      })
      if (featureGate) return featureGate

      if (!(await isProPlan(supabase, user.id))) {
        return fail(
          ErrorCode.FORBIDDEN,
          'Pro subscription required for Ghost Reveal',
          undefined,
          undefined,
          bridge,
          requestId
        )
      }

      const companyData = await identifyCompany(visitor_ip)

      // RLS-safe insert: include tenant key
      try {
        await supabase.from('website_visitors').insert({
          user_id: user.id,
          ip_address: visitor_ip,
          company_name: companyData.companyName,
          company_domain: companyData.companyDomain,
          company_industry: companyData.companyIndustry,
          visited_at: new Date().toISOString(),
        })
      } catch {
        // Ignore schema mismatch; don't fail reveal itself.
      }

      return ok(
        {
          company: companyData.companyName || 'Unknown',
          domain: companyData.companyDomain,
          industry: companyData.companyIndustry,
          confidence: companyData.confidence,
        },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      captureBreadcrumb({
        category: 'clearbit',
        level: 'error',
        message: 'reveal_failed',
        data: { route: '/api/reveal', requestId },
      })
      return asHttpError(error, '/api/reveal', userId, bridge, requestId)
    }
  },
  {
    bodySchema: RevealPostSchema,
  }
)

/**
 * GET: Return embeddable tracking script for Ghost Reveal
 */
export async function GET(request: NextRequest) {
  const script = `
(function() {
  // LeadIntel Ghost Reveal Tracking
  const revealUrl = '${request.nextUrl.origin}/api/reveal';
  
  // Get visitor IP and send to reveal endpoint
  fetch('/api/tracker', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      user_agent: navigator.userAgent,
      referer: document.referrer,
      url: window.location.href
    })
  }).then(function(res) {
    if (!res.ok) {
      throw new Error('Tracker response not OK: ' + res.status);
    }
    return res.json();
  })
    .then(function(data) {
      // If we get an IP, use Ghost Reveal to identify company
      if (data && data.ip) {
        fetch(revealUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ visitor_ip: data.ip })
        }).catch(function(err) {
          console.error('Reveal error:', err);
        });
      }
    })
    .catch(function(err) {
      console.error('Tracker fetch error:', err);
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
 * Identify company from IP using Clearbit Reveal API
 */
async function identifyCompany(ip: string): Promise<RevealResponse> {
  const clearbitKey = serverEnv.CLEARBIT_REVEAL_API_KEY
  if (!clearbitKey) {
    throw new Error('Configuration Error: Missing API Key - CLEARBIT_REVEAL_API_KEY')
  }

  try {
    const response = await fetch(`https://reveal.clearbit.com/v1/companies/find?ip=${ip}`, {
      headers: {
        'Authorization': `Bearer ${clearbitKey}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Clearbit API returned ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    return {
      companyName: data.name || 'Unknown Company',
      companyDomain: data.domain,
      companyIndustry: data.category?.industry,
      confidence: data.confidence || 'medium',
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error identifying company with Clearbit:', { message })
    throw new Error(`Failed to identify company: ${message}`)
  }
}
