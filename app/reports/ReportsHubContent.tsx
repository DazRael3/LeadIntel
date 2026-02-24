import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { PlanTier } from '@/lib/billing/plan'
import type { SavedReportSummary } from '@/lib/services/pitchesList'

export function ReportsHubContent({
  tier,
  reports,
}: {
  tier: PlanTier
  reports: SavedReportSummary[]
}) {
  const isStarter = tier === 'starter'
  const visible = isStarter ? reports.slice(0, 3) : reports

  return (
    <div className="min-h-screen bg-background terminal-grid py-12">
      <div className="container mx-auto px-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold bloomberg-font neon-cyan">Saved reports</h1>
            <p className="text-muted-foreground mt-2">
              Your past competitive briefs and pitches, ready to reopen in the dashboard.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" className="neon-border hover:glow-effect">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>

        {isStarter && (
          <Card className="border-cyan-500/20 bg-card/60">
            <CardContent className="py-5 space-y-3">
              <p className="text-sm text-muted-foreground">
                You’re on the Starter plan. You can view your 3 most recent reports. Upgrade to unlock full report history.
              </p>
              <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect">
                <Link href="/pricing">View pricing &amp; plans</Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {visible.length === 0 ? (
          <Card className="border-cyan-500/20 bg-card/60">
            <CardContent className="py-10 text-center space-y-3">
              <p className="text-lg font-semibold">No reports yet</p>
              <p className="text-sm text-muted-foreground">Generate your first competitive report in the dashboard to see it here.</p>
              <Button asChild size="sm" className="neon-border hover:glow-effect">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {visible.map((r) => (
              <Card key={r.id} className="border-cyan-500/20 bg-card/60" data-testid="saved-report-row">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <CardTitle className="text-lg">{r.companyName}</CardTitle>
                    <div className="text-xs text-muted-foreground">{r.createdAt.toLocaleString()}</div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {r.previewBullets.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {r.previewBullets.slice(0, 2).map((b, idx) => (
                        <li key={idx}>{b}</li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect">
                      <Link href={r.deepLinkHref}>Open in dashboard</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

