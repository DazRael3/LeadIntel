'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'
import { formatDateTime } from '@/lib/i18n/formatting'

type Source = {
  id: string
  name: string
  description: string
  kind: string
  availability: string
  capabilities: string[]
  governanceNotes: string[]
}

type Runtime = { id: string; configured: boolean; notes: string[] }

type Envelope =
  | { ok: true; data: { sources: Source[]; runtime: Runtime[] } }
  | { ok: false; error?: { message?: string } }

export function SourcesSettingsClient() {
  const [loading, setLoading] = useState(true)
  const [sources, setSources] = useState<Source[]>([])
  const [runtime, setRuntime] = useState<Runtime[]>([])

  const runtimeById = useMemo(() => new Map(runtime.map((r) => [r.id, r])), [runtime])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/sources', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setSources([])
        setRuntime([])
        return
      }
      setSources(json.data.sources ?? [])
      setRuntime(json.data.runtime ?? [])
      track('source_catalog_viewed', { count: (json.data.sources ?? []).length })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="sources-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Sources</h1>
            <p className="mt-1 text-sm text-muted-foreground">Catalog and configuration status (truthful, non-claimy).</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Catalog</CardTitle>
              <Badge variant="outline">{sources.length} sources</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {loading ? <div>Loading…</div> : null}
            {!loading && sources.length === 0 ? <div>No sources available.</div> : null}
            {!loading && sources.length > 0 ? (
              <div className="space-y-3">
                {sources.map((s) => {
                  const r = runtimeById.get(s.id) ?? null
                  return (
                    <div key={s.id} className="rounded border border-cyan-500/10 bg-background/40 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-foreground font-semibold">{s.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{s.description}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{s.availability}</Badge>
                          <Badge variant="outline">{s.kind}</Badge>
                          <Badge variant="outline">{r?.configured ? 'configured' : 'not configured'}</Badge>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.capabilities.map((c) => (
                          <Badge key={c} variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                            {c}
                          </Badge>
                        ))}
                      </div>

                      {r?.notes?.length ? (
                        <div className="mt-3 text-xs text-muted-foreground">
                          <div className="text-muted-foreground">Runtime</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5">
                            {r.notes.slice(0, 4).map((n, idx) => (
                              <li key={idx}>{n}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {s.governanceNotes?.length ? (
                        <div className="mt-3 text-xs text-muted-foreground">
                          <div className="text-muted-foreground">Governance</div>
                          <ul className="mt-1 space-y-1 list-disc pl-5">
                            {s.governanceNotes.slice(0, 4).map((n, idx) => (
                              <li key={idx}>{n}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="mt-3 text-[11px] text-muted-foreground">Last refreshed: {formatDateTime(new Date().toISOString(), { style: 'short' })}</div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

