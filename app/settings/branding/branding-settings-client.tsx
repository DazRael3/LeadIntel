'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Envelope =
  | { success: true; data: { workspace: { id: string; name: string; client_label: string | null; reference_tags: string[] }; role: string } }
  | { success: false; error?: { message?: string } }

export function BrandingSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string>('rep')
  const [name, setName] = useState('')
  const [clientLabel, setClientLabel] = useState<string>('')
  const [tags, setTags] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/branding', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      const err = json && json.success === false ? json.error?.message : null
      if (!res.ok || !json || json.success !== true) throw new Error(err ?? 'Failed to load')
      setRole(json.data.role ?? 'rep')
      setName(json.data.workspace?.name ?? '')
      setClientLabel(json.data.workspace?.client_label ?? '')
      setTags((json.data.workspace?.reference_tags ?? []).join(', '))
      track('workspace_controls_viewed', { surface: 'settings_branding' })
    } catch (e) {
      toast({ title: 'Branding unavailable', description: e instanceof Error ? e.message : 'Failed to load', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const canEdit = role === 'owner' || role === 'admin'

  async function save() {
    const referenceTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 25)
    const res = await fetch('/api/workspace/branding', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, clientLabel: clientLabel.trim() || null, referenceTags }),
    })
    const json = (await res.json().catch(() => null)) as { success?: boolean; error?: { message?: string } } | null
    if (!res.ok || !json || json.success !== true) {
      toast({ title: 'Save failed', description: json?.error?.message ?? 'Please try again.', variant: 'destructive' })
      return
    }
    toast({ title: 'Saved.' })
    await load()
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workspace presentation (bounded)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div>These controls affect how the workspace is labeled in multi-workspace views. They are not white-labeling.</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">No custom domains</Badge>
            <Badge variant="outline">No branded emails</Badge>
            <Badge variant="outline">Workspace-only labels</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Branding</CardTitle>
          <Button variant="secondary" onClick={load} disabled={loading}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Workspace name</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit || loading} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Client / project label (optional)</div>
            <Input value={clientLabel} onChange={(e) => setClientLabel(e.target.value)} disabled={!canEdit || loading} placeholder="e.g., Acme (Agency Client)" />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Reference tags (comma-separated)</div>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} disabled={!canEdit || loading} placeholder="agency, outbound, q1-rollout" />
          </div>

          <Button onClick={() => void save()} disabled={!canEdit || loading}>
            Save
          </Button>
          {!canEdit ? <div className="text-xs text-muted-foreground">Only owner/admin can edit branding.</div> : null}
        </CardContent>
      </Card>
    </div>
  )
}

