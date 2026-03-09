export type VerticalSupportLevel = 'supported' | 'vertical_friendly' | 'not_yet_supported'

export type VerticalKey =
  | 'b2b_saas_outbound'
  | 'gtm_revops_tooling'
  | 'sales_tech_gtm_software'
  | 'agency_partner_outbound'
  | 'services_consulting_outbound'

export type VerticalPersonaKey = 'rep' | 'manager' | 'operator' | 'admin'

export type VerticalUseCaseKey =
  | 'timing_first_prospecting'
  | 'account_based_outbound'
  | 'enablement_template_standardization'
  | 'operator_workflow_handoff'

export type VerticalDefinition = {
  key: VerticalKey
  label: string
  supportLevel: VerticalSupportLevel
  shortDescription: string
  bestForBullets: string[]
  notBestForBullets: string[]
  personaSet: VerticalPersonaKey[]
  useCases: VerticalUseCaseKey[]
  proofBoundaries: string[]
  operationalConsiderations: string[]
}

export type VerticalUseCaseDefinition = {
  key: VerticalUseCaseKey
  label: string
  description: string
  recommendedSteps: string[]
  relatedRoutes: string[]
}

