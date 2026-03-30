import type { Tier } from '@/lib/billing/tier'
import { tierAtLeast } from '@/lib/billing/tier'

export type CapabilityKey =
  | 'sample_workspace'
  | 'guided_checklist'
  | 'tour_goals'
  | 'multi_watchlists'
  | 'watchlist_notes'
  | 'watchlist_reminders'
  | 'why_now_digest_in_app'
  | 'why_now_digest_email'
  | 'report_refresh'
  | 'report_diff'
  | 'angle_library'
  | 'angle_variants'
  | 'approvals'
  | 'audit_log'
  | 'governance_exports'
  | 'shared_metrics_dashboard'
  | 'multi_workspace_controls'
  | 'territory_controls'
  | 'integration_destination_health'
  | 'integration_delivery_audit'
  | 'team_dashboards'
  | 'executive_dashboard'

export type Capabilities = Record<CapabilityKey, boolean>

const ALL_FALSE: Capabilities = {
  sample_workspace: false,
  guided_checklist: false,
  tour_goals: false,
  multi_watchlists: false,
  watchlist_notes: false,
  watchlist_reminders: false,
  why_now_digest_in_app: false,
  why_now_digest_email: false,
  report_refresh: false,
  report_diff: false,
  angle_library: false,
  angle_variants: false,
  approvals: false,
  audit_log: false,
  governance_exports: false,
  shared_metrics_dashboard: false,
  multi_workspace_controls: false,
  territory_controls: false,
  integration_destination_health: false,
  integration_delivery_audit: false,
  team_dashboards: false,
  executive_dashboard: false,
}

/**
 * Canonical plan capability mapping.
 *
 * This module is intentionally client-safe (no env reads, no DB access).
 * Server-side routes MUST still enforce capabilities.
 */
export function getTierCapabilities(tier: Tier): Capabilities {
  // Starter: proof + guided tour goals (no team ops surfaces).
  if (tier === 'starter') {
    return {
      ...ALL_FALSE,
      sample_workspace: true,
      guided_checklist: true,
      tour_goals: true,
    }
  }

  // Closer: adds watchlists v2 + why-now digest.
  if (tier === 'closer') {
    return {
      ...ALL_FALSE,
      tour_goals: true,
      multi_watchlists: true,
      watchlist_notes: true,
      watchlist_reminders: true,
      why_now_digest_in_app: true,
      why_now_digest_email: true,
    }
  }

  // Closer+: adds report refresh/diff + angle library.
  if (tier === 'closer_plus') {
    return {
      ...getTierCapabilities('closer'),
      report_refresh: true,
      report_diff: true,
      angle_library: true,
      angle_variants: true,
    }
  }

  // Team: all capabilities.
  return {
    ...getTierCapabilities('closer_plus'),
    approvals: true,
    audit_log: true,
    governance_exports: true,
    shared_metrics_dashboard: true,
    multi_workspace_controls: true,
    territory_controls: true,
    integration_destination_health: true,
    integration_delivery_audit: true,
    team_dashboards: true,
    executive_dashboard: true,
  }
}

export function hasCapability(tier: Tier, capability: CapabilityKey): boolean {
  return getTierCapabilities(tier)[capability] === true
}

export function tierMeetsFeatureMinimum(args: {
  tier: Tier
  minimum: 'starter' | 'closer' | 'closer_plus' | 'team'
}): boolean {
  return args.minimum === 'starter' ? true : tierAtLeast(args.tier, args.minimum)
}

