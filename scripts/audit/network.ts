export type RequestFailedKind = 'requestfailed' | 'aborted_prefetch' | 'aborted_request'

export function classifyRequestFailed(args: {
  url: string
  method: string
  failure: string | null
}): { kind: RequestFailedKind } {
  const failure = args.failure ?? ''
  const isAborted = failure.includes('net::ERR_ABORTED')
  if (!isAborted) return { kind: 'requestfailed' }

  // Next.js RSC prefetches are frequently aborted during navigation and should not be treated as failures.
  if (args.url.includes('_rsc=')) return { kind: 'aborted_prefetch' }

  // In-app fetch/XHR requests can also be aborted during route transitions (e.g. settings pages).
  // These are not server failures and should not pollute the audit "failed requests" count.
  return { kind: 'aborted_request' }
}

