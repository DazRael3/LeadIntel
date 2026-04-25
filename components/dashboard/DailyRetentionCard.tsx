'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buildDailyEmailHook } from '@/lib/retention/daily-email-hook'

type LeadActivityEnvelope =
  | {
      ok: true
      data: {
        summary: {
          newLeadsSinceLastVisit: number
          campaignsAwaitingAction: number
        }
      }
    }
  | { ok: false }

type RecentActivityEnvelope =
  | {
      ok: true
      data: {
        items: Array<{ id: string; kind: string; createdAt: string; label: string; href: string | null }>
      }
    }
  | { ok: false }

type DailyRetentionCardProps = {
  totalLeads: number
  nicheLabel?: string | null
}

export function DailyRetentionCard({ totalLeads, nicheLabel }: DailyRetentionCardProps) {
  const [newLeadsCount, setNewLeadsCount] = useState(0)
  const [campaignsAwaitingAction, setCampaignsAwaitingAction] = useState(0)
  const [readyToContact, setReadyToContact] = useState(0)
  const [leadsGeneratedThisWeek, setLeadsGeneratedThisWeek] = useState(0)
  const [daysActiveStreak, setDaysActiveStreak] = useState(1)

  useEffect(() => {
    let cancelled = false
    async function loadRetentionData(): Promise<void> {
      try {
        const [leadActivityRes, recentActivityRes] = await Promise.all([
          fetch('/api/lead-activity', { cache: 'no-store' }),
          fetch('/api/activity/recent', { cache: 'no-store' }),
        ])

        const leadActivity = (await leadActivityRes.json().catch(() => null)) as LeadActivityEnvelope | null
        const recentActivity = (await recentActivityRes.json().catch(() => null)) as RecentActivityEnvelope | null
        if (cancelled) return

        const summary =
          leadActivityRes.ok && leadActivity && leadActivity.ok === true
            ? leadActivity.data.summary
            : { newLeadsSinceLastVisit: 0, campaignsAwaitingAction: 0 }
        setNewLeadsCount(summary.newLeadsSinceLastVisit)
        setCampaignsAwaitingAction(summary.campaignsAwaitingAction)
        setReadyToContact(Math.max(0, summary.newLeadsSinceLastVisit - summary.campaignsAwaitingAction))

        if (recentActivityRes.ok && recentActivity && recentActivity.ok === true) {
          const items = Array.isArray(recentActivity.data.items) ? recentActivity.data.items : []
          const now = Date.now()
          const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
          const thisWeekCount = items.reduce((count, item) => {
            const createdAt = Date.parse(item.createdAt)
            return Number.isFinite(createdAt) && createdAt >= sevenDaysAgo ? count + 1 : count
          }, 0)
          setLeadsGeneratedThisWeek(thisWeekCount)

          const activeDays = new Set<string>()
          for (const item of items) {
            const createdAt = Date.parse(item.createdAt)
            if (!Number.isFinite(createdAt)) continue
            activeDays.add(new Date(createdAt).toISOString().slice(0, 10))
          }
          setDaysActiveStreak(Math.max(1, Math.min(activeDays.size, 7)))
        } else {
          setLeadsGeneratedThisWeek(0)
          setDaysActiveStreak(1)
        }
      } catch {
        if (cancelled) return
        setNewLeadsCount(0)
        setCampaignsAwaitingAction(0)
        setReadyToContact(0)
        setLeadsGeneratedThisWeek(0)
        setDaysActiveStreak(1)
      }
    }

    void loadRetentionData()
    return () => {
      cancelled = true
    }
  }, [])

  const personalizationLabel = useMemo(() => {
    if (nicheLabel && nicheLabel.trim().length > 0) return nicheLabel.trim()
    return 'your recent activity'
  }, [nicheLabel])

  const emailHook = useMemo(
    () =>
      buildDailyEmailHook({
        newLeadsCount,
        nicheLabel: personalizationLabel,
      }),
    [newLeadsCount, personalizationLabel]
  )

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Today&apos;s Leads</CardTitle>
          <Badge variant="outline">Updated today</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">New leads for {personalizationLabel}</div>
          <div className="mt-1 text-2xl font-semibold text-foreground">{newLeadsCount}</div>
          <div className="mt-1 text-xs text-muted-foreground">These leads update daily</div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Leads generated this week</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{leadsGeneratedThisWeek}</div>
          </div>
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Usage streak</div>
            <div className="mt-1 text-lg font-semibold text-foreground">{daysActiveStreak} day{daysActiveStreak === 1 ? '' : 's'}</div>
          </div>
        </div>

        <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-sm">
          <div className="font-medium text-foreground">You have {readyToContact} leads ready to contact</div>
          <div className="mt-1 text-xs text-muted-foreground">
            Leads viewed but not contacted are prioritized here. Campaigns with no activity: {campaignsAwaitingAction}
          </div>
        </div>

        <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
          <div className="font-medium text-foreground">Daily email hook (structure)</div>
          <div className="mt-1">Subject: {emailHook.subject}</div>
          <div>CTA: {emailHook.ctaLabel}</div>
          <div>CTA link: {emailHook.ctaHref}</div>
        </div>

        <div className="text-[11px] text-muted-foreground">Total tracked leads: {totalLeads}</div>
      </CardContent>
    </Card>
  )
}
