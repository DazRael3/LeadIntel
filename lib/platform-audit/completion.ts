export type CompletionStatus =
  | 'complete'
  | 'mostly_complete'
  | 'partial'
  | 'missing'
  | 'regressed'
  | 'public_only'
  | 'internal_only'
  | 'docs_only'
  | 'test_gap'

export type AuditDomainKey =
  | 'homepage_public_positioning'
  | 'pricing_packaging'
  | 'trust_center_buyer_readiness'
  | 'compare_hub_pages'
  | 'tour'
  | 'roadmap'
  | 'use_cases_verticalization'
  | 'free_tier_preview_model'
  | 'onboarding_activation'
  | 'dashboard_account_workflow'
  | 'action_center_handoffs'
  | 'team_collaboration_approvals'
  | 'manager_executive_command_center'
  | 'assistant_copilot'
  | 'integrations_automation'
  | 'api_developer_platform'
  | 'source_registry_enrichment'
  | 'crm_closed_loop'
  | 'benchmarking_category_intelligence'
  | 'customer_success_adoption'
  | 'enablement_training'
  | 'security_trust_ops'
  | 'localization'
  | 'performance_snapshots_jobs'
  | 'packaging_launch_gtm_ops'
  | 'multi_workspace_partner'
  | 'internal_operator_admin_coherence'
  | 'tests'
  | 'docs'

export type AuditDomain = {
  key: AuditDomainKey
  label: string
  status: CompletionStatus
  evidence: string[]
  notes: string
  fixNow: string[]
  defer: string[]
}

export const COMPLETION_AUDIT_DOMAINS: AuditDomain[] = [
  {
    key: 'homepage_public_positioning',
    label: 'Homepage / public positioning',
    status: 'mostly_complete',
    evidence: ['app/(public)/page.tsx', 'lib/copy/leadintel.ts'],
    notes: 'Premium “why-now signals + send-ready outreach” positioning is centralized in shared copy and reflected in public pages.',
    fixNow: ['Tighten terminology drift where “digest” vs “shortlist” appears on public surfaces.'],
    defer: [],
  },
  {
    key: 'pricing_packaging',
    label: 'Pricing and packaging',
    status: 'mostly_complete',
    evidence: ['app/(public)/pricing/page.tsx', 'components/Pricing.tsx', 'lib/billing/resolve-tier.ts', 'lib/team/gating.ts'],
    notes: 'Real Stripe checkout + tier resolver exist. Free preview limits are enforced server-side and surfaced in UI.',
    fixNow: ['Ensure free-tier language is preview-accurate everywhere and consistent with usage meter strings.'],
    defer: ['Formalize packaging docs as the canonical source for plan/feature mapping.'],
  },
  {
    key: 'trust_center_buyer_readiness',
    label: 'Trust center / buyer readiness',
    status: 'complete',
    evidence: ['app/(public)/trust/page.tsx', 'app/(public)/security/page.tsx', 'app/(public)/privacy/page.tsx', 'app/(public)/dpa/page.tsx'],
    notes: 'Trust Center index exists and links to buyer-ready policy pages without over-claiming certifications.',
    fixNow: ['Ensure footer/trust links point to human-readable version page (not raw API).'],
    defer: [],
  },
  {
    key: 'compare_hub_pages',
    label: 'Compare hub and compare pages',
    status: 'complete',
    evidence: ['app/(public)/compare/page.tsx', 'app/(public)/compare/[slug]/page.tsx', 'lib/compare/registry.ts'],
    notes: 'Ranked competitor matrix + buyer-grade compare pages exist with careful, non-fabricated claims.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'tour',
    label: 'Tour',
    status: 'mostly_complete',
    evidence: ['app/(public)/tour/page.tsx', 'components/marketing/InteractiveWorkspaceDemo.tsx'],
    notes: 'Interactive preview exists with a realistic example workflow.',
    fixNow: [],
    defer: ['Continue narrowing copy to match the deepest implemented account surfaces.'],
  },
  {
    key: 'roadmap',
    label: 'Roadmap',
    status: 'mostly_complete',
    evidence: ['app/(public)/roadmap/page.tsx'],
    notes: 'Directional roadmap exists. Must remain clearly non-committal on ship dates.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'use_cases_verticalization',
    label: 'Use cases / verticalization',
    status: 'mostly_complete',
    evidence: ['app/(public)/use-cases/page.tsx', 'lib/verticals/registry.ts', 'lib/use-cases/registry.ts'],
    notes: 'Use-cases hub exists and now includes bounded vertical/motion framing without fake “industry specialization.”',
    fixNow: ['Ensure use-case hub messaging stays workflow-based and links to real supporting surfaces (templates, pricing, sample).'],
    defer: ['Expand vertical curation only when backed by real workflow support and template depth.'],
  },
  {
    key: 'free_tier_preview_model',
    label: 'Free-tier preview model',
    status: 'complete',
    evidence: [
      'lib/billing/premium-generations.ts',
      'components/billing/UsageMeter.tsx',
      'components/billing/RecentPremiumActivityPanel.tsx',
      'docs/FREE_TIER_PREVIEW_MODEL.md',
    ],
    notes: 'Free is enforced as 3 shared preview generations across pitches and reports. Redaction is server-enforced and surfaced in UI.',
    fixNow: ['Keep pricing/onboarding/help copy aligned to the preview model strings.'],
    defer: [],
  },
  {
    key: 'onboarding_activation',
    label: 'Onboarding / activation',
    status: 'mostly_complete',
    evidence: ['components/OnboardingWizard.tsx', 'app/dashboard/hooks/useOnboarding.ts', 'lib/copy/leadintel.ts'],
    notes: 'Guided activation exists (ICP, accounts, first pitch).',
    fixNow: ['Audit onboarding copy for preview vs full-output clarity.'],
    defer: [],
  },
  {
    key: 'dashboard_account_workflow',
    label: 'Dashboard / account workflow',
    status: 'mostly_complete',
    evidence: ['app/dashboard/page.tsx', 'lib/data/getAccountExplainability.ts', 'components/account/SignalsPanel.tsx'],
    notes: 'Dashboard and explainability surfaces exist and are deterministic.',
    fixNow: [],
    defer: ['Continue consolidating shared state and post-action continuity patterns.'],
  },
  {
    key: 'action_center_handoffs',
    label: 'Action center and handoffs',
    status: 'mostly_complete',
    evidence: ['components/account/AccountActionCenter.tsx', 'app/api/accounts/[accountId]/actions/outreach-variants/route.ts'],
    notes: 'Outreach variants and operational actions exist with plan gating. Webhooks/exports exist for Team.',
    fixNow: [],
    defer: ['Deeper “handoff recipes” should remain roadmap-only unless implemented.'],
  },
  {
    key: 'team_collaboration_approvals',
    label: 'Team collaboration / approvals',
    status: 'complete',
    evidence: ['app/settings/team/page.tsx', 'app/settings/templates/page.tsx', 'app/settings/audit/page.tsx'],
    notes: 'Team-gated settings for members/templates/audit exist.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'manager_executive_command_center',
    label: 'Manager/executive/command-center',
    status: 'partial',
    evidence: ['app/dashboard/DashboardShell.tsx'],
    notes: 'Some dashboard consolidation exists, but dedicated executive/command-center mode is not fully evidenced as a distinct surface.',
    fixNow: ['Keep public claims conservative; do not imply a full command-center product.'],
    defer: ['Implement a dedicated executive surface only when metrics/filters/state coherence are real and tested.'],
  },
  {
    key: 'assistant_copilot',
    label: 'Assistant / copilot',
    status: 'missing',
    evidence: [],
    notes: 'No strong code evidence of a full assistant/copilot surface; avoid claiming it publicly.',
    fixNow: ['Ensure no public pages imply copilot/assistant workflows.'],
    defer: ['If added, must be grounded, permission-safe, and test-covered.'],
  },
  {
    key: 'integrations_automation',
    label: 'Integrations and automation',
    status: 'mostly_complete',
    evidence: [
      'app/settings/integrations/page.tsx',
      'app/settings/exports/page.tsx',
      'app/api/cron/run/route.ts',
      'lib/jobs/*',
    ],
    notes: 'Webhooks + exports + cron jobs + ops visibility exist. Must keep rate limiting + locks safe.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'api_developer_platform',
    label: 'API / developer platform',
    status: 'partial',
    evidence: ['lib/api/policy.ts', 'lib/api/guard.ts', 'lib/api/http.ts'],
    notes: 'Policy-driven API guard exists; broader developer platform (public docs, SDK) is not strongly evidenced.',
    fixNow: ['Keep public positioning as “webhook/export actions” rather than a general API platform.'],
    defer: ['Add developer docs only when endpoints are stable and intentionally supported.'],
  },
  {
    key: 'source_registry_enrichment',
    label: 'Source registry / enrichment',
    status: 'mostly_complete',
    evidence: ['lib/sources/*', 'app/api/sources/refresh/route.ts', 'app/api/sources/status/route.ts'],
    notes: 'Source-backed competitive reports exist with citations, caching, and refresh orchestration.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'crm_closed_loop',
    label: 'CRM closed loop',
    status: 'partial',
    evidence: ['lib/crm/format.ts'],
    notes: 'Only limited CRM formatting code is evidenced; no full CRM closed-loop integration is claimed.',
    fixNow: ['Avoid public claims of CRM sync/closed-loop intelligence unless code-backed.'],
    defer: [],
  },
  {
    key: 'benchmarking_category_intelligence',
    label: 'Benchmarking / category intelligence',
    status: 'missing',
    evidence: [],
    notes: 'No meaningful benchmarking surfaces are evidenced. Keep roadmap-only.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'customer_success_adoption',
    label: 'Customer success / adoption',
    status: 'partial',
    evidence: ['app/admin/growth/page.tsx'],
    notes: 'Some growth/ops instrumentation exists; full CS/adoption tooling is not evidenced as a product surface.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'enablement_training',
    label: 'Enablement / training',
    status: 'partial',
    evidence: ['app/(public)/templates/page.tsx', 'app/(public)/how-scoring-works/page.tsx'],
    notes: 'Templates + scoring methodology act as enablement; no dedicated training/certification system is evidenced.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'security_trust_ops',
    label: 'Security / trust ops',
    status: 'mostly_complete',
    evidence: ['app/(public)/status/page.tsx', 'app/admin/ops/page.tsx', 'middleware.ts'],
    notes: 'Security headers/CSP, ops health, status, and admin ops diagnostics exist.',
    fixNow: ['Ensure public links land on human-readable pages (version) and never leak secrets.'],
    defer: [],
  },
  {
    key: 'localization',
    label: 'Localization',
    status: 'missing',
    evidence: [],
    notes: 'No i18n/localization framework is evidenced; keep copy English-only and avoid claims.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'performance_snapshots_jobs',
    label: 'Performance / snapshots / jobs',
    status: 'mostly_complete',
    evidence: ['lib/jobs/*', 'app/api/admin/kpi-monitor/*', 'supabase/migrations/0044_kpi_monitor_snapshots.sql'],
    notes: 'Job system exists with locks and persisted KPI snapshots.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'packaging_launch_gtm_ops',
    label: 'Packaging / launch / GTM ops',
    status: 'partial',
    evidence: ['docs/LAUNCH_CHECKLIST.md', 'app/admin/growth/page.tsx'],
    notes: 'Launch readiness docs exist; formal packaging matrix docs should be added to prevent drift.',
    fixNow: ['Add packaging docs as canonical truth for plan/feature mapping.'],
    defer: [],
  },
  {
    key: 'multi_workspace_partner',
    label: 'Multi-workspace / partner',
    status: 'partial',
    evidence: ['supabase/migrations/0036_team_workspaces_templates_audit.sql'],
    notes: 'Workspace tables exist; broader partner/multi-workspace operations are not fully evidenced as product UI.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'internal_operator_admin_coherence',
    label: 'Internal/operator/admin coherence',
    status: 'mostly_complete',
    evidence: ['app/admin/ops/page.tsx', 'app/admin/growth/page.tsx', 'app/admin/refinement/page.tsx'],
    notes: 'Admin ops surfaces exist and are token-gated. Refinement board added for coherence tracking.',
    fixNow: [],
    defer: [],
  },
  {
    key: 'tests',
    label: 'Tests',
    status: 'mostly_complete',
    evidence: ['vitest.config.ts', 'tests/e2e/*', '.github/workflows/ci.yml', '.github/workflows/e2e.yml'],
    notes: 'Vitest + Playwright exist. Public copy and critical gating flows should be regression covered.',
    fixNow: ['Add/adjust E2E assertions for free-tier preview language, version link, and use-cases hub framing.'],
    defer: [],
  },
  {
    key: 'docs',
    label: 'Docs',
    status: 'mostly_complete',
    evidence: ['docs/*'],
    notes: 'Docs exist across ops, trust, free-tier model, and recent refinements. Packaging matrix docs need to be added.',
    fixNow: ['Add PACKAGING_MODEL and FEATURE_PACKAGING_MATRIX to prevent public/product drift.'],
    defer: [],
  },
] as const

