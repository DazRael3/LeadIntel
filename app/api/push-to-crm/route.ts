import { NextRequest } from 'next/server'
import { getServerEnv } from '@/lib/env'
import { ok, asHttpError, ErrorCode, createCookieBridge, fail } from '@/lib/api/http'
import { z } from 'zod'
import { assertFeatureEnabled } from '@/lib/services/feature-flags'
import { captureBreadcrumb } from '@/lib/observability/sentry'
import { withApiGuard } from '@/lib/api/guard'
import { createRouteClient } from '@/lib/supabase/route'

const PushToCrmSchema = z.object({
  company_name: z.string().optional(),
  trigger_event: z.string().optional(),
  prospect_email: z.string().email().optional(),
  prospect_linkedin: z.string().url().optional(),
  contact_email: z.string().email().optional(),
  ai_personalized_pitch: z.string().optional(),
  created_at: z.string().optional(),
})

export const POST = withApiGuard(
  async (request: NextRequest, { body, userId, requestId }) => {
    const bridge = createCookieBridge()
    try {
      const supabase = createRouteClient(request, bridge)
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user || !userId) {
        return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge, requestId)
      }

      const gate = await assertFeatureEnabled('zapier_push', {
        route: '/api/push-to-crm',
        mode: 'user',
        requestId,
        tenantId: user.id,
        supabase,
      })
      if (gate) return gate

      captureBreadcrumb({
        category: 'zapier',
        level: 'info',
        message: 'push_to_crm_invoked',
        data: { route: '/api/push-to-crm', requestId },
      })

      const leadData = body as z.infer<typeof PushToCrmSchema>

      // Get Zapier webhook URL (lazy load at runtime, not during build)
      const env = getServerEnv()
      const ZAPIER_WEBHOOK_URL = env.ZAPIER_WEBHOOK_URL || 'https://hooks.zapier.com/hooks/catch/YOUR_WEBHOOK_ID/'

      // Send lead data to Zapier webhook
      const response = await fetch(ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_name: leadData.company_name,
          trigger_event: leadData.trigger_event,
          prospect_email: leadData.prospect_email,
          prospect_linkedin: leadData.prospect_linkedin,
          contact_email: leadData.contact_email,
          ai_personalized_pitch: leadData.ai_personalized_pitch,
          created_at: leadData.created_at,
          source: 'leadintel',
        }),
      })

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`)
      }

      const result = await response.json().catch(() => ({ status: 'sent' }))

      return ok(
        {
          message: 'Lead pushed to CRM successfully',
          data: result,
        },
        undefined,
        bridge,
        requestId
      )
    } catch (error) {
      return asHttpError(error, '/api/push-to-crm', userId, bridge, requestId)
    }
  },
  { bodySchema: PushToCrmSchema }
)
