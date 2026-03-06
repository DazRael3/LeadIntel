'use client'

import * as React from 'react'
import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SignalEvent } from '@/lib/domain/explainability'
import { formatRelativeDate, formatSignalType, safeExternalLink } from '@/lib/domain/explainability'
import { COPY } from '@/lib/copy/leadintel'

export type SignalsPanelWindow = '7d' | '30d' | '90d' | 'all'
export type SignalsPanelSort = 'recent' | 'confidence'

export function SignalsPanel(props: {
  signals: SignalEvent[]
  loading?: boolean
  error?: string | null
  window: SignalsPanelWindow
  sort: SignalsPanelSort
  selectedType: string | null
  onChangeWindow: (w: SignalsPanelWindow) => void
  onChangeSort: (s: SignalsPanelSort) => void
  onChangeType: (type: string | null) => void
  onGeneratePitchDraft?: () => void
}) {
  const router = useRouter()

  const availableTypes = useMemo(() => {
    const set = new Set<string>()
    for (const s of props.signals) {
      const t = s.type.trim()
      if (t) set.add(t)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [props.signals])

  const hasConfidence = useMemo(() => props.signals.some((s) => typeof s.confidence === 'number'), [props.signals])

  const windows: Array<{ key: SignalsPanelWindow; label: string }> = [
    { key: '7d', label: '7d' },
    { key: '30d', label: '30d' },
    { key: '90d', label: '90d' },
    { key: 'all', label: 'All' },
  ]

  const sortedSignals = useMemo(() => {
    if (props.sort === 'confidence' && hasConfidence) {
      return [...props.signals].sort((a, b) => (b.confidence ?? -1) - (a.confidence ?? -1))
    }
    return [...props.signals].sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
  }, [props.signals, props.sort, hasConfidence])

  const empty = sortedSignals.length === 0

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Signals</CardTitle>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="signals_sort">
              Sort
            </label>
            <select
              id="signals_sort"
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={hasConfidence ? props.sort : 'recent'}
              onChange={(e) => props.onChangeSort(e.target.value as SignalsPanelSort)}
              disabled={!hasConfidence}
            >
              <option value="recent">Most recent</option>
              {hasConfidence ? <option value="confidence">Highest confidence</option> : null}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Window</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Signals time window">
            {windows.map((w) => (
              <Button
                key={w.key}
                size="sm"
                variant={props.window === w.key ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                aria-pressed={props.window === w.key}
                onClick={() => props.onChangeWindow(w.key)}
              >
                {w.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">Filter</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by signal type">
            <Button
              size="sm"
              variant={props.selectedType === null ? 'default' : 'outline'}
              className="h-7 px-2 text-xs"
              aria-pressed={props.selectedType === null}
              onClick={() => props.onChangeType(null)}
            >
              All
            </Button>
            {availableTypes.map((t) => (
              <Button
                key={t}
                size="sm"
                variant={props.selectedType === t ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                aria-pressed={props.selectedType === t}
                onClick={() => props.onChangeType(t)}
              >
                {formatSignalType(t)}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="text-sm text-muted-foreground">
        {props.loading ? (
          <div className="py-6 text-xs text-muted-foreground">Loading signals…</div>
        ) : props.error ? (
          <div className="py-6 text-xs text-muted-foreground">Something didn’t load.</div>
        ) : empty ? (
          <div className="py-10 text-center">
            <div className="text-lg font-semibold mb-2 text-foreground">{COPY.states.empty.noSignals.title}</div>
            <div className="text-sm text-muted-foreground mb-5">{COPY.states.empty.noSignals.body}</div>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button
                className="neon-border hover:glow-effect"
                onClick={() => {
                  if (props.onGeneratePitchDraft) props.onGeneratePitchDraft()
                  else router.push('/pitch')
                }}
              >
                {COPY.states.empty.noSignals.primary}
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                {COPY.states.empty.noSignals.secondary}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedSignals.map((s) => {
              const dateLabel = s.occurredAt ? 'Occurred' : 'Detected'
              const date = s.occurredAt ?? s.detectedAt
              const sourceUrl = safeExternalLink(s.sourceUrl)
              return (
                <div
                  key={s.id}
                  className="rounded-lg border border-cyan-500/20 bg-background/30 hover:bg-background/50 transition-colors p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge variant="outline" className="border-cyan-500/30 text-cyan-200 bg-cyan-500/10 text-xs">
                          {formatSignalType(s.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground" title={new Date(date).toLocaleString()}>
                          {dateLabel}: {formatRelativeDate(date)}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-foreground leading-snug">{s.title}</div>
                      {s.summary ? (
                        <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.summary}</div>
                      ) : null}
                      {sourceUrl ? (
                        <div className="mt-2 text-xs">
                          <Link
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline"
                          >
                            Source
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

