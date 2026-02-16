import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function logProductEvent(params: {
  userId: string | null
  eventName: string
  eventProps?: Record<string, unknown>
}): Promise<void> {
  try {
    const client = createSupabaseAdminClient()
    await client.from('product_analytics').insert({
      user_id: params.userId,
      event_name: params.eventName,
      event_props: params.eventProps ?? {},
    })
  } catch (err) {
    console.warn('[analytics] logProductEvent failed', {
      eventName: params.eventName,
      message: err instanceof Error ? err.message : 'unknown',
    })
  }
}

