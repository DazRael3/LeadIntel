export type IngestRejectReason =
  | 'feed_fetch_failed'
  | 'feed_parse_failed'
  | 'item_missing_title'
  | 'item_missing_link'
  | 'item_invalid_link'
  | 'target_no_match'
  | 'duplicate_signal'

export type ProspectWatchIngestStats = {
  feedsAttempted: number
  feedsFetchedOk: number
  feedsParsedOk: number
  itemsScanned: number
  itemsMatched: number
  signalsProposed: number
  signalsInserted: number
  signalsDeduped: number
  rejected: Record<IngestRejectReason, number>
  notes: string[]
}

export function createIngestStats(args: { feedsAttempted: number }): ProspectWatchIngestStats {
  return {
    feedsAttempted: args.feedsAttempted,
    feedsFetchedOk: 0,
    feedsParsedOk: 0,
    itemsScanned: 0,
    itemsMatched: 0,
    signalsProposed: 0,
    signalsInserted: 0,
    signalsDeduped: 0,
    rejected: {
      feed_fetch_failed: 0,
      feed_parse_failed: 0,
      item_missing_title: 0,
      item_missing_link: 0,
      item_invalid_link: 0,
      target_no_match: 0,
      duplicate_signal: 0,
    },
    notes: [],
  }
}

export function bumpReject(stats: ProspectWatchIngestStats, reason: IngestRejectReason): void {
  stats.rejected[reason] = (stats.rejected[reason] ?? 0) + 1
}

