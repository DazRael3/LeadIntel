export type DirectionalMetricCounts = {
  metric: string
  byVariant: Record<string, number>
  total: number
}

export type DirectionalExperimentResults = {
  experimentKey: string
  windowDays: number
  exposures: { total: number; byVariant: Record<string, number> }
  primaryMetrics: DirectionalMetricCounts[]
  secondaryMetrics: DirectionalMetricCounts[]
  note: string
}

