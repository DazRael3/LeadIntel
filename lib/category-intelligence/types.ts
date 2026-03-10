export type CategoryConfidenceLabel = 'limited' | 'usable' | 'strong'

export type CategorySignalInsight = {
  type: 'category_signal'
  label: string
  key: string
  summary: string
  confidence: CategoryConfidenceLabel
  limitationsNote: string | null
  computedAt: string
  version: string
}

