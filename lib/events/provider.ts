import type { TriggerEventCandidate, TriggerEventInput } from '@/lib/services/triggerEvents'

export type TriggerEventsProviderKind = 'none' | 'newsapi' | 'custom'

export interface TriggerEventsProvider {
  fetchEvents(input: TriggerEventInput): Promise<TriggerEventCandidate[]>
}

function normalizeProviderKind(raw: string | undefined | null): TriggerEventsProviderKind {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'newsapi') return 'newsapi'
  if (v === 'custom') return 'custom'
  return 'none'
}

class NoneProvider implements TriggerEventsProvider {
  async fetchEvents(): Promise<TriggerEventCandidate[]> {
    return []
  }
}

class NewsApiProvider implements TriggerEventsProvider {
  async fetchEvents(_input: TriggerEventInput): Promise<TriggerEventCandidate[]> {
    // TODO: Implement real ingestion via NewsAPI (or replace with a better provider).
    // IMPORTANT:
    // - This must be guarded behind env vars and be resilient (return [] on errors).
    // - Do not hit external APIs in unit tests.
    return []
  }
}

class CustomProvider implements TriggerEventsProvider {
  async fetchEvents(_input: TriggerEventInput): Promise<TriggerEventCandidate[]> {
    // Placeholder for teams wiring a private pipeline.
    // Return [] by default to keep the system robust.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[trigger-events] TRIGGER_EVENTS_PROVIDER=custom is not configured; returning 0 events')
    }
    return []
  }
}

export function getTriggerEventsProvider(): { kind: TriggerEventsProviderKind; provider: TriggerEventsProvider } {
  const kind = normalizeProviderKind(process.env.TRIGGER_EVENTS_PROVIDER)
  if (kind === 'newsapi') return { kind, provider: new NewsApiProvider() }
  if (kind === 'custom') return { kind, provider: new CustomProvider() }
  return { kind: 'none', provider: new NoneProvider() }
}

