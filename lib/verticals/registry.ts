import type { VerticalDefinition, VerticalKey } from './types'

export const VERTICALS: Record<VerticalKey, VerticalDefinition> = {
  b2b_saas_outbound: {
    key: 'b2b_saas_outbound',
    label: 'B2B SaaS outbound',
    supportLevel: 'supported',
    shortDescription: 'Timing-first outbound workflows: shortlist → explain → draft → action.',
    bestForBullets: [
      'Account-based outbound teams who work from a target list.',
      'Reps who need clear “why now” context and send-ready drafts.',
      'Operators who need explainability and export/webhook actions.',
    ],
    notBestForBullets: [
      'Bulk contact database sourcing.',
      'Fully automated sequencing without rep review.',
      'Claims-based “intent” without citations or visible inputs.',
    ],
    personaSet: ['rep', 'manager', 'operator', 'admin'],
    useCases: ['timing_first_prospecting', 'account_based_outbound', 'enablement_template_standardization', 'operator_workflow_handoff'],
    proofBoundaries: [
      'LeadIntel does not claim universal contact coverage or a full CRM.',
      'Signals and reports must remain explainable and source-backed when presented as fact.',
    ],
    operationalConsiderations: ['Rate-limited public endpoints', 'Team governance for shared templates and audit logs', 'Webhook + exports for operational handoff'],
  },

  gtm_revops_tooling: {
    key: 'gtm_revops_tooling',
    label: 'RevOps / Enablement tooling motions',
    supportLevel: 'vertical_friendly',
    shortDescription: 'Standardize workflow and messaging while keeping scoring explainable.',
    bestForBullets: [
      'Teams that need consistent templates and rollout governance.',
      'Operators who care about visible reasons and auditability.',
      'Workflows where exports/webhooks are part of the handoff.',
    ],
    notBestForBullets: ['Complex enterprise governance claims (SSO/SCIM) that are not implemented.', 'Deep CRM-native orchestration as a primary interface.'],
    personaSet: ['manager', 'operator', 'admin'],
    useCases: ['enablement_template_standardization', 'operator_workflow_handoff', 'account_based_outbound'],
    proofBoundaries: ['Positioning remains workflow-based; no unsupported compliance or enterprise certifications are claimed.'],
    operationalConsiderations: ['Template approvals (Team)', 'Audit log visibility (Team)', 'Export/webhook safety (preview redaction on Free)'],
  },

  sales_tech_gtm_software: {
    key: 'sales_tech_gtm_software',
    label: 'GTM software / sales tech',
    supportLevel: 'vertical_friendly',
    shortDescription: 'Use launch, hiring, partnership, and displacement triggers to time outreach.',
    bestForBullets: ['Teams selling into GTM orgs with change-driven buying moments.', 'Outbound motions where timing matters more than list size.'],
    notBestForBullets: ['Database-first prospecting motions where volume is the primary lever.'],
    personaSet: ['rep', 'manager', 'operator'],
    useCases: ['timing_first_prospecting', 'account_based_outbound'],
    proofBoundaries: ['No claims of total market coverage or identity resolution beyond what the product actually shows.'],
    operationalConsiderations: ['Source freshness surfaces (where enabled)', 'Explainable scoring reasons'],
  },

  agency_partner_outbound: {
    key: 'agency_partner_outbound',
    label: 'Agency / partner-led outbound teams',
    supportLevel: 'vertical_friendly',
    shortDescription: 'A repeatable timing-first workflow that reduces blank-page work per client.',
    bestForBullets: ['Teams managing multiple client lists and needing consistent drafts.', 'Operators who need export/webhook outputs for handoff.'],
    notBestForBullets: ['Multi-tenant client portals with separate billing/roles (not claimed).'],
    personaSet: ['rep', 'operator', 'admin'],
    useCases: ['timing_first_prospecting', 'enablement_template_standardization', 'operator_workflow_handoff'],
    proofBoundaries: ['No claims about white-labeling, client portals, or partner management unless implemented.'],
    operationalConsiderations: ['Workspace isolation expectations', 'Audit logs and approvals for consistent outputs'],
  },

  services_consulting_outbound: {
    key: 'services_consulting_outbound',
    label: 'Services / consulting outbound',
    supportLevel: 'vertical_friendly',
    shortDescription: 'Outbound timing and message standards for services teams selling outcomes.',
    bestForBullets: ['Teams selling services who still run account-based outbound.', 'Operators who want a clear “why now” narrative and templates.'],
    notBestForBullets: ['Highly regulated vertical claims without source-backed proof or documented controls.'],
    personaSet: ['rep', 'manager', 'operator'],
    useCases: ['account_based_outbound', 'enablement_template_standardization'],
    proofBoundaries: ['No industry-specific compliance claims are made by default.'],
    operationalConsiderations: ['Use templates as a baseline; keep claims grounded in real signals/citations'],
  },
} as const

export const VERTICAL_LIST = Object.values(VERTICALS)

