import type { SourceDefinition } from '@/lib/sources/types'

export const SOURCE_REGISTRY: SourceDefinition[] = [
  {
    id: 'first_party_visits',
    name: 'First-party intent (website visits)',
    description: 'First-party visitor matching (workspace-scoped). Used for intent signals and freshness.',
    kind: 'first_party',
    availability: 'active',
    capabilities: ['first_party_intent', 'signals', 'citations'],
    governanceNotes: [
      'First-party matching is workspace-scoped and does not imply identity certainty.',
      'Do not treat first-party presence as verified buyer intent without supporting signals.',
    ],
  },
  {
    id: 'trigger_events',
    name: 'Trigger events (ingestion)',
    description: 'News/market trigger events ingestion into LeadIntel trigger_events.',
    kind: 'third_party',
    availability: 'configurable',
    capabilities: ['signals', 'citations', 'news'],
    governanceNotes: [
      'Providers run only when configured; missing provider keys should produce no-ops, not fake results.',
      'Trigger event ingestion is deduped best-effort and is not a guaranteed coverage feed.',
    ],
  },
  {
    id: 'gdelt_news',
    name: 'GDELT (news)',
    description: 'News enrichment via GDELT snapshots for company sources bundle.',
    kind: 'third_party',
    availability: 'configurable',
    capabilities: ['news', 'citations', 'enrichment_snapshot'],
    governanceNotes: ['This is best-effort enrichment; it may be unavailable depending on environment configuration.'],
  },
  {
    id: 'sec_filings',
    name: 'SEC filings (public)',
    description: 'Best-effort SEC filings snapshots when match is found.',
    kind: 'third_party',
    availability: 'limited',
    capabilities: ['filings', 'citations', 'enrichment_snapshot'],
    governanceNotes: [
      'Coverage is limited to companies with mappable SEC identity.',
      'Do not imply comprehensive filings coverage or real-time updates.',
    ],
  },
  {
    id: 'jobs_boards',
    name: 'Jobs boards (signals)',
    description: 'Hiring signals sourced from public ATS/job board detection (best-effort).',
    kind: 'third_party',
    availability: 'limited',
    capabilities: ['jobs', 'signals', 'citations', 'enrichment_snapshot'],
    governanceNotes: ['Detection is heuristic; absence does not imply no hiring activity.'],
  },
  {
    id: 'webhooks',
    name: 'Webhooks (destinations)',
    description: 'Workspace-configured webhook endpoints for delivery of workflow payloads.',
    kind: 'internal',
    availability: 'active',
    capabilities: ['webhook_delivery'],
    governanceNotes: ['Webhook secrets must never be re-shown after creation; delivery errors are sanitized.'],
  },
  {
    id: 'exports',
    name: 'Exports (delivery)',
    description: 'Export jobs and delivery history for safe data movement.',
    kind: 'internal',
    availability: 'active',
    capabilities: ['export_delivery'],
    governanceNotes: ['Exports must respect entitlement-based redaction and workspace policies.'],
  },
  {
    id: 'crm_observations',
    name: 'CRM observations (manual linkage)',
    description: 'Explicit CRM mapping and downstream observation entry (generic system, no vendor sync implied).',
    kind: 'manual',
    availability: 'configurable',
    capabilities: ['crm_observation'],
    governanceNotes: ['Downstream observations are workspace-entered and verified; not a live CRM sync.'],
  },
  {
    id: 'manual_outcomes',
    name: 'Manual outcomes',
    description: 'Workspace outcomes recorded by users (replied/meeting/etc).',
    kind: 'manual',
    availability: 'active',
    capabilities: ['signals'],
    governanceNotes: ['Outcomes are observed inputs; do not treat them as causally attributed to any single action.'],
  },
]

export function getSourceDefinition(id: SourceDefinition['id']): SourceDefinition | null {
  return SOURCE_REGISTRY.find((s) => s.id === id) ?? null
}

