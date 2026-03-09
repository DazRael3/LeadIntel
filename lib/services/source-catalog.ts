import type { SourceRuntimeStatus } from '@/lib/sources/types'
import { SOURCE_REGISTRY } from '@/lib/sources/registry'
import { getServerEnv } from '@/lib/env'

export function getSourceRuntimeStatus(): SourceRuntimeStatus[] {
  const env = getServerEnv()

  // Important: only return booleans + non-secret notes. Never return secret values.
  const triggerProvidersConfigured = Boolean(env.TRIGGER_EVENTS_PROVIDERS || env.TRIGGER_EVENTS_PROVIDER)
  const gdeltConfigured = Boolean(env.GDELT_BASE_URL)
  const secConfigured = true // public endpoints are used; coverage is still limited (handled in registry).

  return SOURCE_REGISTRY.map((s): SourceRuntimeStatus => {
    if (s.id === 'trigger_events') {
      return {
        id: s.id,
        configured: triggerProvidersConfigured,
        notes: triggerProvidersConfigured ? ['Providers configured.'] : ['No providers configured; ingestion will be a no-op.'],
      }
    }
    if (s.id === 'gdelt_news') {
      return {
        id: s.id,
        configured: gdeltConfigured,
        notes: gdeltConfigured ? ['Configured.'] : ['GDELT base URL not configured; enrichment may be unavailable.'],
      }
    }
    if (s.id === 'sec_filings') {
      return { id: s.id, configured: secConfigured, notes: ['Public source; coverage is best-effort and company-dependent.'] }
    }
    if (s.id === 'crm_observations') {
      return { id: s.id, configured: true, notes: ['Manual mappings/observations require workspace policy enablement.'] }
    }
    if (s.id === 'webhooks' || s.id === 'exports' || s.id === 'manual_outcomes' || s.id === 'first_party_visits' || s.id === 'jobs_boards') {
      return { id: s.id, configured: true, notes: [] }
    }
    return { id: s.id, configured: false, notes: [] }
  })
}

