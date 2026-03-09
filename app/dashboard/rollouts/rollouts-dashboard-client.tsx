'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type WorkspaceAccess = { workspace: { id: string; name: string }; role: string; source: string }
type TemplateRow = { id: string; slug: string; title: string; status: string }

type TemplatesEnvelope =
  | { success: true; data: { templates: TemplateRow[] } }
  | { success: false; error?: { message?: string } }
type DirectoryEnvelope =
  | { success: true; data: { workspaces: WorkspaceAccess[] } }
  | { success: false; error?: { message?: string } }
type RolloutsEnvelope =
  | { success: true; data: { jobs: any[]; items: any[] } }
  | { success: false; error?: { message?: string } }

export function RolloutsDashboardClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceAccess[]>([])
  const [jobs, setJobs] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])

  const [templateId, setTemplateId] = useState<string>('')
  const [targets, setTargets] = useState<Record<string, boolean>>({})
  const [name, setName] = useState('Template rollout')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [tRes, dRes, rRes] = await Promise.all([
        fetch('/api/team/templates?status=approved', { cache: 'no-store' }),
        fetch('/api/workspaces/directory', { cache: 'no-store' }),
        fetch('/api/partners/rollouts', { cache: 'no-store' }),
      ])

      const tJson = (await tRes.json().catch(() => null)) as TemplatesEnvelope | null
      const dJson = (await dRes.json().catch(() => null)) as DirectoryEnvelope | null
      const rJson = (await rRes.json().catch(() => null)) as RolloutsEnvelope | null

      const tErr = tJson && tJson.success === false ? tJson.error?.message : null
      const dErr = dJson && dJson.success === false ? dJson.error?.message : null
      const rErr = rJson && rJson.success === false ? rJson.error?.message : null

      if (!tRes.ok || !tJson || tJson.success !== true) throw new Error(tErr ?? 'Failed to load templates')
      if (!dRes.ok || !dJson || dJson.success !== true) throw new Error(dErr ?? 'Failed to load workspaces')
      if (!rRes.ok || !rJson || rJson.success !== true) throw new Error(rErr ?? 'Failed to load rollouts')

      setTemplates(tJson.data.templates ?? [])
      setWorkspaces(dJson.data.workspaces ?? [])
      setJobs(rJson.data.jobs ?? [])
      setItems(rJson.data.items ?? [])

      if (!templateId && (tJson.data.templates ?? []).length > 0) {
        setTemplateId((tJson.data.templates ?? [])[0]!.id)
      }
      track('multiworkspace_operations_viewed', { surface: 'rollouts' })
    } catch (e) {
      toast({ title: 'Rollouts unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
      setTemplates([])
      setWorkspaces([])
      setJobs([])
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [templateId, toast])

  useEffect(() => {
    void load()
  }, [load])

  const targetIds = useMemo(() => Object.entries(targets).filter(([, v]) => v).map(([k]) => k), [targets])

  async function createRollout() {
    if (!templateId || targetIds.length === 0) {
      toast({ title: 'Select a template and at least one target', variant: 'destructive' })
      return
    }
    const res = await fetch('/api/partners/rollouts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ templateId, targetWorkspaceIds: targetIds, name }),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null
    if (!res.ok || !json || json.success !== true) {
      toast({ title: 'Rollout failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    toast({ title: 'Rollout created' })
    track('shared_playbook_distributed', { targets: targetIds.length })
    setTargets({})
    await load()
  }

  function toggleTarget(id: string) {
    setTargets((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>Rollouts</CardTitle>
            <div className="text-sm text-muted-foreground">
              Distribute approved templates by copying into target workspaces. Copies are created as drafts so local governance can apply.
            </div>
          </div>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Source template</div>
              <select
                className="h-9 w-full rounded border border-cyan-500/20 bg-background/30 px-2 text-sm text-foreground"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                disabled={loading}
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.slug})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Rollout name</div>
              <input
                className="h-9 w-full rounded border border-cyan-500/20 bg-background/30 px-2 text-sm text-foreground"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Target workspaces (owner/admin only)</div>
            <div className="flex flex-wrap gap-2">
              {workspaces
                .filter((w) => w.role === 'owner' || w.role === 'admin')
                .map((w) => (
                  <button
                    key={w.workspace.id}
                    type="button"
                    onClick={() => toggleTarget(w.workspace.id)}
                    disabled={loading}
                    className={`rounded border px-2 py-1 text-xs ${
                      targets[w.workspace.id]
                        ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
                        : 'border-border bg-background text-muted-foreground'
                    }`}
                  >
                    {w.workspace.name}
                  </button>
                ))}
            </div>
          </div>

          <Button onClick={() => void createRollout()} disabled={loading}>
            Create rollout
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent rollouts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {jobs.length === 0 ? <div className="text-sm text-muted-foreground">No rollouts yet.</div> : null}
          {jobs.map((j) => (
            <div key={j.id} className="rounded border border-border/60 bg-background/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-foreground">{j.name}</div>
                  <div className="text-xs text-muted-foreground">{j.id}</div>
                </div>
                <Badge variant="outline">{j.status}</Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

