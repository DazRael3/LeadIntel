"use client"

import Link from 'next/link'
import { computeReportQuality } from '@/lib/reports/quality'

export function LegacyCitationBannerClient(props: {
  reportMarkdown: string
  companyName: string
  inputUrl: string | null
  sourcesUsed: unknown | null
  sourcesFetchedAt: string | null
}) {
  const q = computeReportQuality({
    reportMarkdown: props.reportMarkdown,
    sourcesUsed: props.sourcesUsed,
    sourcesFetchedAt: props.sourcesFetchedAt,
  })

  if (q.citations >= 2) return null

  const params = new URLSearchParams()
  if (props.companyName) params.set('company', props.companyName)
  if (props.inputUrl) params.set('url', props.inputUrl)

  return (
    <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">This report does not meet current citation requirements.</div>
      <div className="mt-1">
        Regenerate with a website URL or ticker so the report can include at least 2 real citations.
      </div>
      <div className="mt-2">
        <Link className="text-cyan-400 hover:underline" href={`/competitive-report/new?${params.toString()}`}>
          Regenerate report
        </Link>
      </div>
    </div>
  )
}

