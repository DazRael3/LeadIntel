import { sanitizeGrowthEventProps } from '@/lib/growth-events/validators'
import type { GrowthEventName } from '@/lib/growth-events/types'

export type FunnelEventName =
  | 'page_view'
  | 'demo_started'
  | 'results_viewed'
  | 'signup_completed'
  | 'checkout_started'
  | 'payment_completed'
  | 'view_content'
  | 'initiate_checkout'
  | 'purchase'

const FUNNEL_EVENTS = new Set<FunnelEventName>([
  'page_view',
  'demo_started',
  'results_viewed',
  'signup_completed',
  'checkout_started',
  'payment_completed',
  'view_content',
  'initiate_checkout',
  'purchase',
])

const PIXEL_EVENT_MAP: Record<FunnelEventName, FunnelEventName | null> = {
  page_view: 'view_content',
  demo_started: null,
  results_viewed: 'view_content',
  signup_completed: null,
  checkout_started: 'initiate_checkout',
  payment_completed: 'purchase',
  view_content: 'view_content',
  initiate_checkout: 'initiate_checkout',
  purchase: 'purchase',
}

export function isFunnelEventName(value: string): value is FunnelEventName {
  return FUNNEL_EVENTS.has(value as FunnelEventName)
}

export function mapToPixelEvent(value: FunnelEventName): FunnelEventName | null {
  return PIXEL_EVENT_MAP[value]
}

export function normalizedFunnelEventPayload(args: {
  eventName: FunnelEventName
  eventProps?: Record<string, unknown>
}): Record<string, unknown> {
  return sanitizeGrowthEventProps(args.eventProps ?? {})
}

const CANONICAL_EVENT_MAP: Record<string, GrowthEventName> = {
  page_view: 'page_view',
  landing_view: 'page_view',
  landing_viewed: 'page_view',
  demo_started: 'demo_started',
  lead_search_completed: 'results_viewed',
  results_viewed: 'results_viewed',
  signup_completed: 'signup_completed',
  subscription_created: 'payment_completed',
  payment_completed: 'payment_completed',
  checkout_started: 'checkout_started',
  upgrade_clicked: 'checkout_started',
}

export function canonicalFunnelEvent(eventName: string): GrowthEventName | null {
  return CANONICAL_EVENT_MAP[eventName.trim()] ?? null
}

export function normalizeFunnelEventName(eventName: string): string {
  return canonicalFunnelEvent(eventName) ?? eventName
}

export function normalizeToFunnelEvent(eventName: string): GrowthEventName | null {
  return canonicalFunnelEvent(eventName)
}

export async function logCanonicalFunnelEvent(args: {
  supabase: {
    from: (table: string) => {
      insert: (payload: {
        user_id: string | null
        event_name: string
        event_props: Record<string, unknown>
      }) => Promise<unknown>
    }
    schema: (schema: string) => {
      from: (table: string) => {
        insert: (payload: {
          workspace_id: string
          user_id: string
          event_name: string
          event_props: Record<string, unknown>
          source?: string
        }) => Promise<unknown>
      }
    }
  }
  userId: string
  workspaceId?: string | null
  eventName: string
  eventProps?: Record<string, unknown>
  source?: 'app' | 'server' | 'pixel_meta' | 'pixel_tiktok' | 'import'
}): Promise<void> {
  const normalized = normalizeFunnelEventName(args.eventName)
  const safeProps = sanitizeGrowthEventProps(args.eventProps ?? {})
  await args.supabase.from('product_analytics').insert({
    user_id: args.userId,
    event_name: normalized,
    event_props: safeProps,
  })
  if (args.workspaceId) {
    await args.supabase.schema('api').from('growth_events').insert({
      workspace_id: args.workspaceId,
      user_id: args.userId,
      event_name: normalized,
      event_props: safeProps,
      source: args.source ?? 'server',
    })
  }
}
