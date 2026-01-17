import { NextRequest } from 'next/server'
import { createRouteClient } from '@/lib/supabase/route'
import { ok, fail, asHttpError, ErrorCode, createCookieBridge } from '@/lib/api/http'
import { validateBody, validationError } from '@/lib/api/validate'
import { DigestTestSchema } from '@/lib/api/schemas'

export const dynamic = 'force-dynamic'

async function sendWebhook(url: string, text: string) {
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
}

export async function POST(request: NextRequest) {
  const bridge = createCookieBridge()
  
  try {
    // Validate request body (optional userId for testing)
    let body
    try {
      body = await validateBody(request, DigestTestSchema.partial(), { maxBytes: 1024 })
    } catch (error) {
      return validationError(error, bridge)
    }

    const supabase = createRouteClient(request, bridge)
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return fail(ErrorCode.UNAUTHORIZED, 'Authentication required', undefined, undefined, bridge)
    }

    const { data: settings } = await supabase
      .from('user_settings')
      .select('digest_webhook_url')
      .eq('user_id', user.id)
      .maybeSingle()

    const url = settings?.digest_webhook_url
    if (!url) {
      return fail(ErrorCode.VALIDATION_ERROR, 'No webhook URL set', undefined, undefined, bridge)
    }

    const payload = 'LeadIntel test digest: this is a test message.'
    await sendWebhook(url, payload)
    return ok({ success: true }, undefined, bridge)
  } catch (error) {
    return asHttpError(error, '/api/digest/test', undefined, bridge)
  }
}
