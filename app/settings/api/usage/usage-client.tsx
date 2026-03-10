'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type LogRow = {
  id: string
  api_key_id: string | null
  method: string
  route: string
  status: number
  error_code: string | null
  latency_ms: number | null
  created_at: string
}

type Envelope =
  | { ok: true; data: { workspaceId: string; apiAccessEnabled: boolean; logs: LogRow[] } }
  | { ok: false; error?: { message?: string } }

export function ApiUsageClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<LogRow[]>([])
  const [enabled, setEnabled] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/platform/usage?limit=80', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      const errMsg = json && json.ok === false ? (json.error?.message ?? 'Access restricted.') : 'Access restricted.'
      if (!res.ok || !json || json.ok !== true) throw new Error(errMsg)
      setEnabled(Boolean(json.data.apiAccessEnabled))
      setLogs(json.data.logs ?? [])
      track('api_usage_viewed', { logs: (json.data.logs ?? []).length })
    } catch (e) {
      toast({ title: 'API usage unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
      setLogs([])
      setEnabled(false)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4" data-testid="api-usage-page">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>API usage</CardTitle>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>Sanitized request history for workspace API keys (no bodies, no secrets).</div>
          {!enabled ? <Badge variant="outline">API access disabled</Badge> : <Badge variant="outline">Enabled</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent requests</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {logs.length === 0 ? <div className="text-sm text-muted-foreground">No request logs.</div> : null}
          {logs.length > 0 ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 text-left font-medium">Time</th>
                  <th className="py-2 text-left font-medium">Method</th>
                  <th className="py-2 text-left font-medium">Route</th>
                  <th className="py-2 text-left font-medium">Status</th>
                  <th className="py-2 text-left font-medium">Error</th>
                  <th className="py-2 text-left font-medium">Latency</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-3">
                      <Badge variant="outline">{l.method}</Badge>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs text-foreground">{l.route}</td>
                    <td className="py-2 pr-3">{l.status}</td>
                    <td className="py-2 pr-3">{l.error_code ?? '—'}</td>
                    <td className="py-2 pr-3">{typeof l.latency_ms === 'number' ? `${l.latency_ms}ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

