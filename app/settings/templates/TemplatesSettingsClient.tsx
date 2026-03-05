'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

type Role = 'owner' | 'admin' | 'member'
type Channel = 'email' | 'linkedin_dm' | 'call_opener'
type Status = 'draft' | 'approved'

type TemplateSet = {
  id: string
  name: string
  description: string
  created_at: string
}

type TemplateRow = {
  id: string
  set_id: string | null
  slug: string
  title: string
  channel: Channel
  trigger: string
  persona: string
  length: string
  subject: string | null
  body: string
  tokens: string[]
  status: Status
  approved_at: string | null
}

type SetsEnvelope = { ok: true; data: { role: Role; workspace: { id: string; default_template_set_id: string | null }; sets: TemplateSet[] } }
type TemplatesEnvelope = { ok: true; data: { role: Role; templates: TemplateRow[] } }

export function TemplatesSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<Role>('member')
  const [sets, setSets] = useState<TemplateSet[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [defaultSetId, setDefaultSetId] = useState<string | null>(null)
  const [activeSetId, setActiveSetId] = useState<string | null>(null)

  const [newSetName, setNewSetName] = useState('')
  const [newSetDescription, setNewSetDescription] = useState('')
  const [savingSet, setSavingSet] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    setId: null as string | null,
    slug: '',
    title: '',
    channel: 'email' as Channel,
    trigger: '',
    persona: '',
    length: 'short',
    subject: '',
    body: '',
  })
  const [savingTemplate, setSavingTemplate] = useState(false)

  const isAdmin = role === 'owner' || role === 'admin'

  const filteredTemplates = useMemo(() => {
    if (!activeSetId) return templates
    return templates.filter((t) => t.set_id === activeSetId)
  }, [templates, activeSetId])

  async function refresh() {
    setLoading(true)
    try {
      const [setsRes, templatesRes] = await Promise.all([
        fetch('/api/team/template-sets', { cache: 'no-store' }),
        fetch('/api/team/templates', { cache: 'no-store' }),
      ])
      if (!setsRes.ok || !templatesRes.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      const setsJson = (await setsRes.json()) as SetsEnvelope
      const templatesJson = (await templatesRes.json()) as TemplatesEnvelope
      setRole(setsJson.data.role)
      setSets(setsJson.data.sets ?? [])
      setDefaultSetId(setsJson.data.workspace.default_template_set_id ?? null)
      setTemplates(templatesJson.data.templates ?? [])
      if (!activeSetId && (setsJson.data.workspace.default_template_set_id ?? null)) {
        setActiveSetId(setsJson.data.workspace.default_template_set_id ?? null)
      }
    } catch {
      toast({ variant: 'destructive', title: 'Load failed', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startCreate() {
    setEditingId(null)
    setForm({
      setId: activeSetId,
      slug: '',
      title: '',
      channel: 'email',
      trigger: '',
      persona: '',
      length: 'short',
      subject: '',
      body: '',
    })
  }

  function startEdit(t: TemplateRow) {
    setEditingId(t.id)
    setForm({
      setId: t.set_id,
      slug: t.slug,
      title: t.title,
      channel: t.channel,
      trigger: t.trigger,
      persona: t.persona,
      length: t.length,
      subject: t.subject ?? '',
      body: t.body,
    })
  }

  async function saveSet() {
    setSavingSet(true)
    try {
      const res = await fetch('/api/team/template-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSetName, description: newSetDescription }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      toast({ title: 'Saved.' })
      setNewSetName('')
      setNewSetDescription('')
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
    } finally {
      setSavingSet(false)
    }
  }

  async function saveDefault(setId: string | null) {
    try {
      const res = await fetch('/api/team/template-sets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setId }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      toast({ title: 'Saved.' })
      setDefaultSetId(setId)
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
    }
  }

  async function saveTemplate() {
    setSavingTemplate(true)
    try {
      const payload = {
        setId: form.setId,
        slug: form.slug,
        title: form.title,
        channel: form.channel,
        trigger: form.trigger,
        persona: form.persona,
        length: form.length,
        subject: form.subject.trim().length > 0 ? form.subject : null,
        body: form.body,
        ...(editingId ? { id: editingId } : {}),
      }
      const res = await fetch('/api/team/templates', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        toast({ variant: 'destructive', title: 'Save failed', description: text.slice(0, 120) })
        return
      }
      toast({ title: 'Saved.' })
      startCreate()
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
    } finally {
      setSavingTemplate(false)
    }
  }

  async function approveTemplate(id: string) {
    try {
      const res = await fetch('/api/team/templates/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Access restricted.' })
        return
      }
      toast({ title: 'Template approved.' })
      await refresh()
    } catch {
      toast({ variant: 'destructive', title: 'Approve failed', description: 'Please try again.' })
    }
  }

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="templates-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">Shared templates and approvals.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="border-cyan-500/20 bg-card/50 lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Template sets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="space-y-2">
                <div className="text-xs">Default set</div>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={defaultSetId ?? ''}
                  onChange={(e) => void saveDefault(e.target.value ? e.target.value : null)}
                  disabled={!isAdmin}
                  data-testid="templates-default-set"
                >
                  <option value="">None</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-xs">Browse</div>
                <div className="space-y-1">
                  <button
                    type="button"
                    className={`w-full text-left rounded-md px-2 py-1 ${activeSetId === null ? 'bg-cyan-500/10 text-cyan-200' : 'hover:bg-muted/50'}`}
                    onClick={() => setActiveSetId(null)}
                    data-testid="templates-set-all"
                  >
                    All templates
                  </button>
                  {sets.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full text-left rounded-md px-2 py-1 ${activeSetId === s.id ? 'bg-cyan-500/10 text-cyan-200' : 'hover:bg-muted/50'}`}
                      onClick={() => setActiveSetId(s.id)}
                      data-testid={`templates-set-${s.id}`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="space-y-2 border-t border-cyan-500/10 pt-4">
                  <div className="text-xs text-muted-foreground">Create set</div>
                  <Input value={newSetName} onChange={(e) => setNewSetName(e.target.value)} placeholder="Name" data-testid="templates-new-set-name" />
                  <Input
                    value={newSetDescription}
                    onChange={(e) => setNewSetDescription(e.target.value)}
                    placeholder="Description"
                    data-testid="templates-new-set-description"
                  />
                  <Button
                    onClick={() => void saveSet()}
                    disabled={savingSet || newSetName.trim().length === 0 || newSetDescription.trim().length === 0}
                    className="neon-border hover:glow-effect"
                    data-testid="templates-new-set-submit"
                  >
                    {savingSet ? 'Saving…' : 'Save set'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-cyan-500/20 bg-card/50 lg:col-span-2">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Templates</CardTitle>
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={startCreate} data-testid="templates-create">
                  New
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              {loading ? (
                <div>Loading…</div>
              ) : (
                <>
                  <div className="text-xs">
                    {filteredTemplates.length} shown / {templates.length} total
                  </div>
                  <div className="space-y-2">
                    {filteredTemplates.map((t) => (
                      <div key={t.id} className="rounded-md border border-cyan-500/10 bg-card/30 p-3" data-testid={`templates-row-${t.id}`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {t.title} <span className="text-xs text-muted-foreground">· {t.channel}</span>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {t.slug} · {t.status}
                            </div>
                          </div>
                          {isAdmin && (
                            <div className="flex items-center gap-2">
                              {t.status !== 'approved' && (
                                <Button size="sm" onClick={() => void approveTemplate(t.id)} data-testid={`templates-approve-${t.id}`}>
                                  Approve
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => startEdit(t)} data-testid={`templates-edit-${t.id}`}>
                                Edit
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {isAdmin && (
                    <div className="border-t border-cyan-500/10 pt-4 space-y-3" data-testid="templates-editor">
                      <div className="font-medium text-foreground">{editingId ? 'Edit template' : 'Create template'}</div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={form.setId ?? ''}
                          onChange={(e) => setForm((f) => ({ ...f, setId: e.target.value ? e.target.value : null }))}
                          data-testid="templates-form-set"
                        >
                          <option value="">No set</option>
                          {sets.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="slug" data-testid="templates-form-slug" />
                        <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="title" data-testid="templates-form-title" />
                        <select
                          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                          value={form.channel}
                          onChange={(e) => setForm((f) => ({ ...f, channel: e.target.value as Channel }))}
                          data-testid="templates-form-channel"
                        >
                          <option value="email">Email</option>
                          <option value="linkedin_dm">LinkedIn DM</option>
                          <option value="call_opener">Call opener</option>
                        </select>
                        <Input value={form.trigger} onChange={(e) => setForm((f) => ({ ...f, trigger: e.target.value }))} placeholder="trigger" data-testid="templates-form-trigger" />
                        <Input value={form.persona} onChange={(e) => setForm((f) => ({ ...f, persona: e.target.value }))} placeholder="persona" data-testid="templates-form-persona" />
                        <Input value={form.length} onChange={(e) => setForm((f) => ({ ...f, length: e.target.value }))} placeholder="length" data-testid="templates-form-length" />
                        <Input
                          value={form.subject}
                          onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                          placeholder="subject (optional)"
                          data-testid="templates-form-subject"
                        />
                      </div>

                      <Textarea
                        value={form.body}
                        onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                        placeholder="body"
                        rows={10}
                        data-testid="templates-form-body"
                      />
                      <div className="text-xs text-muted-foreground">
                        Curly tokens only: <span className="font-medium text-foreground">{`{{company}}`}</span>,{' '}
                        <span className="font-medium text-foreground">{`{{trigger}}`}</span>, etc.
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={() => void saveTemplate()} disabled={savingTemplate} className="neon-border hover:glow-effect" data-testid="templates-form-save">
                          {savingTemplate ? 'Saving…' : 'Save'}
                        </Button>
                        <Button variant="outline" onClick={startCreate}>
                          Reset
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

