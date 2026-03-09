'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'
import { WorkspaceContextBadge } from '@/components/navigation/WorkspaceContextBadge'

type WorkspaceAccess = {
  workspace: { id: string; name: string; owner_user_id: string; created_at: string }
  role: string
  source: 'direct' | 'delegated'
}

type DirectoryEnvelope = { success: true; data: { workspaces: WorkspaceAccess[] } } | { success: false; error?: { message?: string } }
type CurrentEnvelope =
  | { success: true; data: { workspace: { id: string; name: string }; role: string | null } }
  | { success: false; error?: { message?: string } }

export function WorkspaceSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<{ id: string; name: string; role: string | null } | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceAccess[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dirRes, curRes] = await Promise.all([fetch('/api/workspaces/directory', { cache: 'no-store' }), fetch('/api/workspaces/current', { cache: 'no-store' })])
      const dirJson = (await dirRes.json().catch(() => null)) as DirectoryEnvelope | null
      const curJson = (await curRes.json().catch(() => null)) as CurrentEnvelope | null
      const dirErr = dirJson && dirJson.success === false ? dirJson.error?.message : null
      const curErr = curJson && curJson.success === false ? curJson.error?.message : null
      if (!dirRes.ok || !dirJson || dirJson.success !== true) throw new Error(dirErr ?? 'Failed to load workspaces')
      if (!curRes.ok || !curJson || curJson.success !== true) throw new Error(curErr ?? 'Failed to load workspace context')
      setWorkspaces(dirJson.data.workspaces ?? [])
      setCurrent({ id: curJson.data.workspace.id, name: curJson.data.workspace.name, role: curJson.data.role ?? null })
      track('workspace_switcher_viewed', { workspacesCount: (dirJson.data.workspaces ?? []).length })
    } catch (e) {
      toast({ title: 'Workspace context unavailable', description: e instanceof Error ? e.message : 'Failed to load workspaces', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const canSwitch = useMemo(() => (workspaces?.length ?? 0) > 1, [workspaces])

  const onSwitch = useCallback(
    async (workspaceId: string) => {
      if (!workspaceId || workspaceId === current?.id) return
      try {
        const res = await fetch('/api/workspaces/switch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ workspaceId }) })
        const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null
        if (!res.ok || !json || json.success !== true) throw new Error(json?.error?.message ?? 'Switch failed')
        track('workspace_switched', { workspaceId, fromPath: pathname })
        // Refresh current route; server components will resolve against the new current workspace.
        router.refresh()
        void load()
      } catch (e) {
        toast({ title: 'Switch failed', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' })
      }
    },
    [current?.id, load, pathname, router, toast]
  )

  if (!current) return null

  return (
    <div className="flex items-center gap-3">
      <WorkspaceContextBadge name={current.name} role={current.role} />
      <div className="hidden sm:flex items-center gap-2">
        <select
          className="h-9 rounded border border-cyan-500/20 bg-background/30 px-2 text-sm text-foreground"
          disabled={!canSwitch || loading}
          value={current.id}
          onChange={(e) => void onSwitch(e.target.value)}
          aria-label="Switch workspace"
        >
          {workspaces.map((w) => (
            <option key={w.workspace.id} value={w.workspace.id}>
              {w.workspace.name} {w.source === 'delegated' ? '(delegated)' : ''}
            </option>
          ))}
        </select>
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={load} disabled={loading}>
          Refresh
        </Button>
      </div>
    </div>
  )
}

