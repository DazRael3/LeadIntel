export type EmbedKind = 'account_summary' | 'shortlist' | 'readiness'

export type EmbedAccountSummary = {
  workspaceId: string
  account: {
    id: string
    name: string | null
    domain: string | null
    programState: string
  }
  readiness: {
    ready: number
    blocked: number
    failed: number
    approvalsPending: number
  }
  computedAt: string
}

export type EmbedShortlist = {
  workspaceId: string
  accounts: Array<{ id: string; name: string | null; domain: string | null; programState: string; updatedAt: string }>
  computedAt: string
}

export type EmbedReadiness = {
  workspaceId: string
  queue: { ready: number; queued: number; processing: number; delivered: number; failed: number; blocked: number; manualReview: number }
  approvalsPending: number
  computedAt: string
}

