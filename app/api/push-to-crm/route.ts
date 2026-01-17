import { NextRequest } from 'next/server'
import { getServerEnv } from '@/lib/env'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { z } from 'zod'

const PushToCrmSchema = z.object({
  company_name: z.string().optional(),
  trigger_event: z.string().optional(),
  prospect_email: z.string().email().optional(),
  prospect_linkedin: z.string().url().optional(),
  contact_email: z.string().email().optional(),
  ai_personalized_pitch: z.string().optional(),
  created_at: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    // Get Zapier webhook URL (lazy load at runtime, not during build)
    const env = getServerEnv()
    const ZAPIER_WEBHOOK_URL = env.ZAPIER_WEBHOOK_URL || 'https://hooks.zapier.com/hooks/catch/YOUR_WEBHOOK_ID/'
    
    // Validate request body (max 2MB for lead data with pitch content)
    let leadData
    try {
      leadData = await validateBody(request, PushToCrmSchema, { maxBytes: 2 * 1024 * 1024 })
    } catch (error) {
      return validationError(error, bridge)
    }

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

    return ok({
      message: 'Lead pushed to CRM successfully',
      data: result,
    }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/push-to-crm', undefined, bridge)
  }
}
