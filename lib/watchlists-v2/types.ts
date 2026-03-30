export type WatchlistReminderStatus = 'none' | 'scheduled' | 'shown' | 'dismissed' | 'completed'

export type WatchlistList = {
  id: string
  workspaceId: string
  name: string
  description: string | null
  isDefault: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export type WatchlistItem = {
  id: string
  workspaceId: string
  watchlistId: string
  leadId: string
  addedBy: string | null
  note: string | null
  reminderAt: string | null
  reminderStatus: WatchlistReminderStatus
  reminderLastShownAt: string | null
  createdAt: string
  updatedAt: string
  lead: {
    id: string
    companyName: string | null
    companyDomain: string | null
    companyUrl: string | null
    isSample?: boolean | null
  } | null
}

