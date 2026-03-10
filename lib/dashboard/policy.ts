import { tierAtLeast, type PaidTier, type Tier } from '@/lib/billing/tier'
import type { Entitlements } from '@/lib/billing/entitlements'

export type DashboardTabKey = 'command' | 'leads' | 'visitors' | 'live-intent' | 'market' | 'watchlist' | 'settings'

export type DashboardTabPolicy = {
  key: DashboardTabKey
  label: string
  /** When true, the tab is rendered in the tab rail. */
  visible: boolean
  /** Optional: required tier to enable the tab. */
  requiredTier?: PaidTier
  /** Optional badge shown in the rail (purely informational). */
  badge?: { label: string }
}

export type DashboardModulePolicy = {
  /** Whether a module is allowed to make requests/mount in the current session. */
  canMount: boolean
  /** If not mountable, how it should be represented to the user (if at all). */
  renderAs?: 'hidden' | 'locked'
  requiredTier?: PaidTier
}

export function getDashboardTabs(args: { tier: Tier; entitlements: Entitlements }): DashboardTabPolicy[] {
  const isStarter = args.tier === 'starter'
  // Starter: keep the rail intentionally small; advanced surfaces are introduced via guided cards in Command Center.
  if (isStarter) {
    return [
      { key: 'command', label: 'Command Center', visible: true },
      { key: 'leads', label: 'Lead Library', visible: true },
      { key: 'settings', label: 'Settings', visible: true },
    ]
  }

  const raw: DashboardTabPolicy[] = [
    { key: 'command', label: 'Command Center', visible: true },
    { key: 'leads', label: 'Lead Library', visible: true },
    { key: 'visitors', label: 'Website Visitors', visible: true, requiredTier: 'closer' },
    { key: 'live-intent', label: 'Live Intent', visible: true, requiredTier: 'closer' },
    { key: 'market', label: 'Market Pulse', visible: true, requiredTier: 'closer' },
    { key: 'watchlist', label: 'Watchlist', visible: true, requiredTier: 'closer' },
    { key: 'settings', label: 'Settings', visible: true },
  ]

  // Only show "locked" badges when a tab is visible but not currently allowed.
  return raw.map((t) => {
    if (!t.requiredTier) return t
    const allowed = tierAtLeast(args.tier, t.requiredTier)
    return allowed ? t : { ...t, badge: { label: tierLabel(t.requiredTier) } }
  })
}

function tierLabel(tier: PaidTier): string {
  return tier === 'closer' ? 'Closer' : tier === 'closer_plus' ? 'Closer+' : 'Team'
}

export function getModulePolicy(args: { tier: Tier; module: 'action_queue' | 'market_sidebar' | 'website_visitors' }): DashboardModulePolicy {
  if (args.module === 'action_queue') {
    // Backed by Team-only endpoints (`requireTeamPlan`).
    return tierAtLeast(args.tier, 'team') ? { canMount: true } : { canMount: false, renderAs: 'locked', requiredTier: 'team' }
  }

  if (args.module === 'website_visitors') {
    return tierAtLeast(args.tier, 'closer') ? { canMount: true } : { canMount: false, renderAs: 'hidden', requiredTier: 'closer' }
  }

  // market_sidebar
  return tierAtLeast(args.tier, 'closer') ? { canMount: true } : { canMount: false, renderAs: 'locked', requiredTier: 'closer' }
}

