'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type Rule = {
  id: string
  name: string
  territory_key: string
  priority: number
  match_type: 'domain_suffix' | 'domain_exact' | 'tag'
  match_value: string
  is_enabled: boolean
  updated_at: string
}

type Envelope = { ok: true; data: { rules: Rule[] } } | { ok: false; error?: { message?: string } }

export function TerritoriesSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [rules, setRules] = useState<Rule[]>([])

  const [name, setName] = useState('')
  const [territoryKey, setTerritoryKey] = useState('')
  const [matchType, setMatchType] = useState<'domain_suffix' | 'domain_exact' | 'tag'>('domain_suffix')
  const [matchValue, setMatchValue] = useState('')
  const [priority, setPriority] = useState('100')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/workspace/territories', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({ variant: 'destructive', title: 'Territories unavailable.' })
        setRules([])
        return
      }
      setRules(json.data.rules ?? [])
      track('territory_page_viewed', { surface: 'settings_territories' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  async function createRule() {
    const res = await fetch('/api/workspace/territories', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name,
        territoryKey,
        matchType,
        matchValue,
        priority: Number(priority || '100'),
        isEnabled: true,
      }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
      toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
      return
    }
    toast({ title: 'Saved.' })
    setName('')
    setTerritoryKey('')
    setMatchValue('')
    setPriority('100')
    await load()
  }

  async function toggle(id: string, next: boolean) {
    const row = rules.find((r) => r.id === id)
    if (!row) return
    const res = await fetch('/api/workspace/territories', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id,
        name: row.name,
        territoryKey: row.territory_key,
        matchType: row.match_type,
        matchValue: row.match_value,
        priority: row.priority,
        isEnabled: next,
      }),
    })
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Save failed' })
      return
    }
    await load()
  }

  async function remove(id: string) {
    const ok = window.confirm('Delete rule?')
    if (!ok) return
    const res = await fetch('/api/workspace/territories', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!res.ok) {
      toast({ variant: 'destructive', title: 'Delete failed' })
      return
    }
    await load()
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="territories-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Territories</h1>
          <p className="mt-1 text-sm text-muted-foreground">Bounded routing rules (no CRM territory sync claims).</p>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Create rule</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-2 text-sm">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rule name" />
            <Input value={territoryKey} onChange={(e) => setTerritoryKey(e.target.value)} placeholder="Territory key (e.g. Enterprise-East)" />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={matchType} onChange={(e) => setMatchType(e.target.value as any)}>
              <option value="domain_suffix">domain suffix</option>
              <option value="domain_exact">domain exact</option>
              <option value="tag">tag (owner-only)</option>
            </select>
            <Input value={matchValue} onChange={(e) => setMatchValue(e.target.value)} placeholder="acme.com or fintech" />
            <div className="flex gap-2">
              <Input value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="priority" />
              <Button className="neon-border hover:glow-effect" onClick={() => void createRule()} disabled={loading || !name.trim() || !territoryKey.trim() || !matchValue.trim()}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Rules</CardTitle>
              <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {loading ? (
              <div>Loading…</div>
            ) : rules.length === 0 ? (
              <div className="text-xs text-muted-foreground">No territory rules yet.</div>
            ) : (
              <div className="overflow-hidden rounded border border-cyan-500/10">
                <table className="w-full text-xs">
                  <thead className="bg-background/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Name</th>
                      <th className="px-3 py-2 text-left">Territory</th>
                      <th className="px-3 py-2 text-left">Match</th>
                      <th className="px-3 py-2 text-left">Priority</th>
                      <th className="px-3 py-2 text-left">Enabled</th>
                      <th className="px-3 py-2 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rules.map((r) => (
                      <tr key={r.id} className="border-t border-cyan-500/10">
                        <td className="px-3 py-2 text-foreground">{r.name}</td>
                        <td className="px-3 py-2">{r.territory_key}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline">
                            {r.match_type}:{r.match_value}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">{r.priority}</td>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={r.is_enabled} onChange={(e) => void toggle(r.id, e.target.checked)} />
                        </td>
                        <td className="px-3 py-2">
                          <Button size="sm" variant="outline" onClick={() => void remove(r.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
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

