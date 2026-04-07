'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { badgeClassForTone, exportJobStatusLabel } from '@/lib/ui/status-labels'

type ExportJob = {
  id: string
  type: 'accounts' | 'signals' | 'templates' | 'pitches'
  status: 'pending' | 'ready' | 'failed'
  created_at: string
  ready_at: string | null
  error: string | null
}

type LoadState = 'loading' | 'ready' | 'error'

type JobsResponse =
  | { ok: true; data?: { jobs?: ExportJob[] } }
  | { ok: false; error?: { code?: string; message?: string } }

export function ExportsSettingsClient() {
  const { toast } = useToast()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState<string | null>(null)
  const [jobs, setJobs] = useState<ExportJob[]>([])

  const refresh = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    try {
      const res = await fetch('/api/exports/jobs', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as JobsResponse | null
      if (!res.ok) {
        const message = json?.ok === false ? (json.error?.message ?? 'Failed to load exports.') : 'Failed to load exports.'
        setLoadState('error')
        setLoadError(message)
        setJobs([])
        toast({ variant: 'destructive', title: 'Load failed', description: message })
        return
      }
      if (!json || json.ok !== true) {
        const message = 'Failed to load exports.'
        setLoadState('error')
        setLoadError(message)
        setJobs([])
        toast({ variant: 'destructive', title: 'Load failed', description: message })
        return
      }
      setJobs(json.data?.jobs ?? [])
      setLoadState('ready')
    } catch {
      const message = 'Please try again.'
      setLoadState('error')
      setLoadError(message)
      setJobs([])
      toast({ variant: 'destructive', title: 'Load failed', description: 'Please try again.' })
    }
  }, [toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function create(type: ExportJob['type']) {
    setCreating(type)
    try {
      const res = await fetch('/api/exports/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Create failed', description: 'Please try again.' })
        return
      }
      toast({ title: 'Saved.' })
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Create failed', description: 'Please try again.' })
    } finally {
      setCreating(null)
    }
  }

  async function download(jobId: string) {
    try {
      const res = await fetch(`/api/exports/${jobId}/download`, { method: 'GET' })
      // If server streams CSV directly, open in a new tab by navigating.
      const ct = res.headers.get('content-type') ?? ''
      if (ct.includes('text/csv')) {
        window.location.href = `/api/exports/${jobId}/download`
        return
      }
      const json = (await res.json()) as { ok?: boolean; data?: { url?: string } }
      const url = json.data?.url
      if (url && typeof url === 'string') {
        window.open(url, '_blank', 'noopener,noreferrer')
        return
      }
      toast({ variant: 'destructive', title: 'Download failed', description: 'Please try again.' })
    } catch {
      toast({ variant: 'destructive', title: 'Download failed', description: 'Please try again.' })
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="exports-page">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Exports</h1>
          <p className="mt-1 text-sm text-muted-foreground">Generate downloadable CSV files.</p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create export</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row gap-3">
            <Button onClick={() => void create('accounts')} disabled={creating !== null} data-testid="export-accounts">
              {creating === 'accounts' ? 'Working…' : 'Export accounts'}
            </Button>
            <Button onClick={() => void create('signals')} disabled={creating !== null} data-testid="export-signals">
              {creating === 'signals' ? 'Working…' : 'Export signals'}
            </Button>
            <Button onClick={() => void create('templates')} disabled={creating !== null} data-testid="export-templates">
              {creating === 'templates' ? 'Working…' : 'Export templates'}
            </Button>
            <Button onClick={() => void create('pitches')} disabled={creating !== null} data-testid="export-pitches">
              {creating === 'pitches' ? 'Working…' : 'Export pitches'}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent jobs</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loadState === 'loading' ? (
              <div>Loading…</div>
            ) : loadState === 'error' ? (
              <div className="space-y-3" data-testid="exports-jobs-error">
                <div className="text-red-300">{loadError ?? 'Failed to load exports.'}</div>
                <Button size="sm" variant="outline" onClick={() => void refresh()}>
                  Retry
                </Button>
              </div>
            ) : jobs.length === 0 ? (
              <div>No export jobs yet.</div>
            ) : (
              <div className="overflow-x-auto" data-testid="exports-jobs">
                <table className="w-full text-left">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((j) => {
                      const st = exportJobStatusLabel(j.status)
                      return (
                        <tr key={j.id} className="border-t border-cyan-500/10">
                          <td className="py-2 pr-4 text-foreground">{j.type}</td>
                          <td className="py-2 pr-4">
                            <Badge variant="outline" className={badgeClassForTone(st.tone)}>
                              {st.label}
                            </Badge>
                          </td>
                          <td className="py-2 pr-4">{new Date(j.created_at).toLocaleString()}</td>
                          <td className="py-2 pr-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void download(j.id)}
                              disabled={j.status !== 'ready'}
                              data-testid={`export-download-${j.id}`}
                            >
                              Download
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

