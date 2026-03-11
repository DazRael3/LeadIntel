'use client'

import { useCallback, useEffect, useState } from 'react'
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

export function WorkspaceSwitcher(props: { showPicker?: boolean } = {}) {
  const router = useRouter()
  const pathname = usePathname()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [current, setCurrent] = useState<{ id: string; name: string; role: string | null } | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceAccess[]>([])
  const [error, setError] = useState<string | null>(null)

  const showPicker = Boolean(props.showPicker)

  const loadCurrent = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const curRes = await fetch('/api/workspaces/current', { cache: 'no-store' })
      const curJson = (await curRes.json().catch(() => null)) as CurrentEnvelope | null
      const curErr = curJson && curJson.success === false ? curJson.error?.message : null
      if (!curRes.ok || !curJson || curJson.success !== true) throw new Error(curErr ?? 'Failed to load workspace context')
      setCurrent({ id: curJson.data.workspace.id, name: curJson.data.workspace.name, role: curJson.data.role ?? null })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load workspace context'
      // Avoid noisy toasts when this is mounted in top chrome; only surface errors in the explicit picker surface.
      if (showPicker) {
        toast({ title: 'Workspace context unavailable', description: message, variant: 'destructive' })
      }
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [showPicker, toast])

  const loadDirectory = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/workspaces/directory', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as DirectoryEnvelope | null
      const err = json && json.success === false ? json.error?.message : null
      if (!res.ok || !json || json.success !== true) throw new Error(err ?? 'Failed to load workspaces')
      setWorkspaces(json.data.workspaces ?? [])
      track('workspace_switcher_viewed', { workspacesCount: (json.data.workspaces ?? []).length })
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load workspaces'
      toast({ title: 'Workspace list unavailable', description: message, variant: 'destructive' })
      setError(message)
      setWorkspaces([])
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    // Only fetch current workspace quietly in top chrome; directory is loaded on-demand in the picker.
    void loadCurrent()
  }, [loadCurrent])

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
        void loadCurrent()
        if (showPicker && workspaces.length > 0) {
          void loadDirectory()
        }
      } catch (e) {
        toast({ title: 'Switch failed', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' })
      }
    },
    [current?.id, loadCurrent, loadDirectory, pathname, router, showPicker, toast, workspaces.length]
  )

  // Always render a stable badge; top chrome should never throw destructive UI for context fetch failures.
  const badgeName = current?.name ?? 'Workspace'

  return (
    <div className="flex items-center gap-3">
      <WorkspaceContextBadge name={badgeName} role={current?.role ?? null} />

      {!showPicker ? null : (
        <div className="flex items-center gap-2">
          {error ? (
            <Button variant="outline" size="sm" onClick={loadCurrent} disabled={loading}>
              Retry
            </Button>
          ) : null}
          <select
            className="h-9 rounded border border-cyan-500/20 bg-background/30 px-2 text-sm text-foreground"
            disabled={loading || !current}
            value={current?.id ?? ''}
            onFocus={() => {
              if (workspaces.length === 0 && !loading) void loadDirectory()
            }}
            onChange={(e) => void onSwitch(e.target.value)}
            aria-label="Switch workspace"
          >
            {workspaces.length === 0 ? (
              <option value={current?.id ?? ''}>{current ? current.name : 'Loading…'}</option>
            ) : (
              workspaces.map((w) => (
                <option key={w.workspace.id} value={w.workspace.id}>
                  {w.workspace.name} {w.source === 'delegated' ? '(delegated)' : ''}
                </option>
              ))
            )}
          </select>
          <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={loadDirectory} disabled={loading || !current}>
            Refresh
          </Button>
        </div>
      )}

      {showPicker ? null : (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="hidden sm:inline-flex text-muted-foreground hover:text-foreground"
        >
          <a href="/settings/workspace">Manage</a>
        </Button>
      )}
    </div>
  )
}

