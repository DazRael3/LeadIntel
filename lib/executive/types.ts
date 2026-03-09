export type ExecutiveHighlight = {
  kind: 'positive' | 'attention' | 'risk'
  title: string
  detail: string
}

export type ExecutiveSummary = {
  workspaceId: string
  computedAt: string
  metrics: {
    actionQueueReady: number
    actionQueueBlocked: number
    approvalsPending: number
    deliveriesFailed7d: number
    strategicPrograms: number
  }
  highlights: ExecutiveHighlight[]
  risks: ExecutiveHighlight[]
  limitationsNote: string
}

