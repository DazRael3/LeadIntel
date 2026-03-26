'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

type ProspectRow = {
  id: string
  overall_score: number
  status: string
  updated_at: string
  company_name: string
  company_domain: string | null
  signal_title: string
  signal_url: string
  signal_type: string
  reasons: string[]
  drafts: Array<{
    id: string
    channel: string
    status: string
    subject: string | null
    body: string
    to_email: string | null
    contact_id?: string | null
    recipient_reviewed?: boolean
    send_ready?: boolean
  }>
}

type ContactRow = {
  id: string
  prospect_id: string
  full_name: string
  title: string | null
  linkedin_url: string | null
  email: string | null
  email_status: 'unknown' | 'candidate' | 'verified' | 'invalid' | 'manually_confirmed'
  confidence_score: number
  selected_for_outreach: boolean
  reviewer_notes: string | null
}

function emailStatusBadge(status: ContactRow['email_status']): { label: string; className: string } {
  if (status === 'verified' || status === 'manually_confirmed') {
    return { label: status === 'verified' ? 'Verified' : 'Confirmed', className: 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10' }
  }
  if (status === 'candidate') return { label: 'Candidate', className: 'border-amber-500/30 text-amber-200 bg-amber-500/10' }
  if (status === 'invalid') return { label: 'Invalid', className: 'border-red-500/30 text-red-200 bg-red-500/10' }
  return { label: 'Unknown', className: 'border-slate-700/60 text-muted-foreground bg-slate-900/40' }
}

type QueueEnvelope =
  | { ok: true; data: { workspaceId: string | null; role: string | null; items: ProspectRow[]; configured?: boolean; reason?: string } }
  | { ok: false; error?: { message?: string; code?: string }; data?: unknown }

export function ProspectsSettingsClient() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ProspectRow[]>([])
  const [queueMeta, setQueueMeta] = useState<{ workspaceId: string | null; role: string | null; reason?: string; configured?: boolean } | null>(null)
  const [filter, setFilter] = useState<'review' | 'all'>('review')
  const [saving, setSaving] = useState<string | null>(null)
  const [newTarget, setNewTarget] = useState({ companyName: '', companyDomain: '', icpFitScore: 70, icpNotes: '' })
  const [contactsByProspect, setContactsByProspect] = useState<Record<string, ContactRow[]>>({})
  const [newContactByProspect, setNewContactByProspect] = useState<Record<string, { fullName: string; title: string; email: string; linkedinUrl: string }>>({})

  const visible = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((i) => i.status === 'new' || i.status === 'reviewed')
  }, [filter, items])

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/prospect-watch/queue?kind=prospects', { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as QueueEnvelope | null
      if (!res.ok || !json || json.ok !== true) {
        toast({
          variant: 'destructive',
          title: 'Could not load prospects',
          description: json && json.ok === false ? json.error?.message ?? 'Please try again.' : 'Please try again.',
        })
        setItems([])
        setQueueMeta(null)
        return
      }
      setItems(json.data.items ?? [])
      setQueueMeta({ workspaceId: json.data.workspaceId ?? null, role: json.data.role ?? null, configured: json.data.configured, reason: json.data.reason })
    } catch {
      toast({ variant: 'destructive', title: 'Load failed', description: 'Please try again.' })
      setItems([])
      setQueueMeta(null)
    } finally {
      setLoading(false)
    }
  }, [toast])

  const loadContacts = useCallback(
    async (prospectId: string) => {
      try {
        const res = await fetch(`/api/prospect-watch/contacts?prospectId=${encodeURIComponent(prospectId)}`, {
          cache: 'no-store',
          credentials: 'include',
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: { items?: ContactRow[] }; error?: { message?: string } } | null
        if (!res.ok || !json || json.ok !== true) {
          toast({ variant: 'destructive', title: 'Could not load contacts', description: json?.error?.message ?? 'Please try again.' })
          return
        }
        setContactsByProspect((prev) => ({ ...prev, [prospectId]: json.data?.items ?? [] }))
      } catch {
        toast({ variant: 'destructive', title: 'Could not load contacts', description: 'Please try again.' })
      }
    },
    [toast]
  )

  const createContact = useCallback(
    async (prospectId: string) => {
      const draft = newContactByProspect[prospectId] ?? { fullName: '', title: '', email: '', linkedinUrl: '' }
      if (!draft.fullName.trim()) return
      setSaving(`contact:create:${prospectId}`)
      try {
        const res = await fetch('/api/prospect-watch/contacts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prospectId,
            fullName: draft.fullName,
            title: draft.title || undefined,
            email: draft.email || undefined,
            linkedinUrl: draft.linkedinUrl || undefined,
            sourceType: 'manual',
            confidenceScore: 60,
            emailStatus: draft.email ? 'candidate' : 'unknown',
          }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
        if (!res.ok || !json || json.ok !== true) {
          toast({ variant: 'destructive', title: 'Create failed', description: json?.error?.message ?? 'Please try again.' })
          return
        }
        setNewContactByProspect((prev) => ({ ...prev, [prospectId]: { fullName: '', title: '', email: '', linkedinUrl: '' } }))
        await loadContacts(prospectId)
      } finally {
        setSaving(null)
      }
    },
    [loadContacts, newContactByProspect, toast]
  )

  const selectContact = useCallback(
    async (prospectId: string, contactId: string) => {
      setSaving(`contact:select:${contactId}`)
      try {
        const res = await fetch('/api/prospect-watch/contacts', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: contactId }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
        if (!res.ok || !json || json.ok !== true) {
          toast({ variant: 'destructive', title: 'Select failed', description: json?.error?.message ?? 'Please try again.' })
          return
        }
        // Refresh contacts and queue; send-ready depends on selected contact status.
        await refresh()
        await loadContacts(prospectId)
      } finally {
        setSaving(null)
      }
    },
    [loadContacts, refresh, toast]
  )

  const setSendReady = useCallback(
    async (draftId: string, on: boolean, contactId: string | null) => {
      setSaving(`draft:sendready:${draftId}`)
      try {
        const res = await fetch('/api/prospect-watch/drafts', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: draftId, sendReady: on, contactId }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
        if (!res.ok || !json || json.ok !== true) {
          toast({ variant: 'destructive', title: 'Update failed', description: json?.error?.message ?? 'Please try again.' })
          return
        }
        await refresh()
      } finally {
        setSaving(null)
      }
    },
    [refresh, toast]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setStatus = useCallback(
    async (id: string, status: 'reviewed' | 'approved' | 'rejected' | 'archived') => {
      setSaving(id)
      try {
        const res = await fetch('/api/prospect-watch/prospects', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, status }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
        if (!res.ok || !json || json.ok !== true) {
          toast({ variant: 'destructive', title: 'Update failed', description: json?.error?.message ?? 'Please try again.' })
          return
        }
        await refresh()
      } finally {
        setSaving(null)
      }
    },
    [refresh, toast]
  )

  const updateDraft = useCallback(
    async (draftId: string, patch: { subject?: string | null; body?: string; toEmail?: string | null }) => {
      setSaving(draftId)
      try {
        const res = await fetch('/api/prospect-watch/drafts', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: draftId, ...patch }),
        })
        const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: { message?: string } } | null
        if (!res.ok || !json || json.ok !== true) {
          toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
          return
        }
        await refresh()
      } finally {
        setSaving(null)
      }
    },
    [refresh, toast]
  )

  return (
    <div className="min-h-screen bg-background terminal-grid" data-testid="prospects-settings-page">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold bloomberg-font neon-cyan">Prospects</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review-first prospect watch queue. Nothing is auto-sent externally by default.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={filter === 'review' ? 'default' : 'outline'} onClick={() => setFilter('review')}>
              Review needed
            </Button>
            <Button size="sm" variant={filter === 'all' ? 'default' : 'outline'} onClick={() => setFilter('all')}>
              All
            </Button>
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>

        <Card className="border-cyan-500/20 bg-card/50">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">Queue</CardTitle>
              <Badge variant="outline">{visible.length} items</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!loading && queueMeta && queueMeta.workspaceId == null ? (
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                Workspace not ready for this account yet. Queue is unavailable until a workspace exists.
              </div>
            ) : null}

            <div className="rounded border border-cyan-500/10 bg-background/30 p-3 space-y-2">
              <div className="text-xs font-semibold text-foreground">Add watch target</div>
              <div className="grid gap-2 md:grid-cols-3">
                <Input
                  value={newTarget.companyName}
                  onChange={(e) => setNewTarget((p) => ({ ...p, companyName: e.target.value }))}
                  placeholder="Company name"
                />
                <Input
                  value={newTarget.companyDomain}
                  onChange={(e) => setNewTarget((p) => ({ ...p, companyDomain: e.target.value }))}
                  placeholder="Domain (optional)"
                />
                <Input
                  value={String(newTarget.icpFitScore)}
                  onChange={(e) => setNewTarget((p) => ({ ...p, icpFitScore: Number.parseInt(e.target.value || '70', 10) }))}
                  placeholder="ICP fit (0-100)"
                  inputMode="numeric"
                />
              </div>
              <Textarea
                value={newTarget.icpNotes}
                onChange={(e) => setNewTarget((p) => ({ ...p, icpNotes: e.target.value }))}
                placeholder="ICP notes (optional)"
                className="min-h-[72px]"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!newTarget.companyName.trim() || saving === 'create-target'}
                  onClick={async () => {
                    setSaving('create-target')
                    try {
                      const res = await fetch('/api/prospect-watch/targets', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          companyName: newTarget.companyName,
                          companyDomain: newTarget.companyDomain || undefined,
                          icpFitScore: newTarget.icpFitScore,
                          icpNotes: newTarget.icpNotes || undefined,
                        }),
                      })
                      const json = (await res.json().catch(() => null)) as any
                      if (!res.ok || !json?.ok) {
                        toast({ variant: 'destructive', title: 'Create failed', description: json?.error?.message ?? 'Please try again.' })
                        return
                      }
                      toast({ title: 'Target added' })
                      setNewTarget({ companyName: '', companyDomain: '', icpFitScore: 70, icpNotes: '' })
                      await refresh()
                    } finally {
                      setSaving(null)
                    }
                  }}
                >
                  Add target
                </Button>
                <div className="text-xs text-muted-foreground self-center">
                  Ingestion runs via cron (`job=prospect_watch`) using approved RSS feeds.
                </div>
              </div>
            </div>

            {loading ? <div className="text-sm text-muted-foreground">Loading…</div> : null}
            {!loading && visible.length === 0 ? (
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">No prospects in queue yet.</div>
                <div className="rounded border border-cyan-500/10 bg-background/30 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="font-semibold text-foreground">Diagnostics</div>
                  <div>Workspace: {queueMeta?.workspaceId ? 'resolved' : queueMeta?.reason === 'workspace_missing' ? 'missing' : 'unknown'}</div>
                  <div>Configured feeds: {queueMeta?.configured === false ? 'no / disabled' : queueMeta?.configured === true ? 'yes' : 'unknown'}</div>
                  <div>
                    Next step:{' '}
                    {queueMeta?.reason === 'workspace_missing'
                      ? 'create/join a workspace, then return to this queue.'
                      : 'add a watch target above, then run the prospect_watch cron to ingest signals.'}
                  </div>
                </div>
              </div>
            ) : null}

            {visible.map((p) => (
              <div key={p.id} className="rounded border border-cyan-500/10 bg-background/40 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-foreground font-semibold">
                      {p.company_name}
                      {p.company_domain ? <span className="text-muted-foreground"> · {p.company_domain}</span> : null}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Signal: <a className="text-cyan-300 hover:underline" href={p.signal_url} target="_blank" rel="noreferrer">{p.signal_title}</a>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Type: {p.signal_type}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-cyan-500/20">{p.overall_score}/100</Badge>
                    <Badge variant="outline">{p.status}</Badge>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {p.reasons.slice(0, 4).map((r, idx) => (
                    <Badge key={idx} variant="outline" className="border-slate-700/60 bg-slate-900/40 text-muted-foreground">
                      {r}
                    </Badge>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={saving === p.id} onClick={() => void setStatus(p.id, 'reviewed')}>
                    Mark reviewed
                  </Button>
                  <Button size="sm" className="neon-border hover:glow-effect" disabled={saving === p.id} onClick={() => void setStatus(p.id, 'approved')}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving === p.id} onClick={() => void setStatus(p.id, 'rejected')}>
                    Reject
                  </Button>
                  <Button size="sm" variant="outline" disabled={saving === p.id} onClick={() => void setStatus(p.id, 'archived')}>
                    Archive
                  </Button>
                  <Link className="text-xs text-cyan-300 hover:underline ml-auto self-center" href="/settings/content">
                    Review content drafts →
                  </Link>
                </div>

                <div className="rounded border border-cyan-500/10 bg-background/30 p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-foreground">Recipient contacts</div>
                    <Button size="sm" variant="outline" onClick={() => void loadContacts(p.id)} disabled={saving?.startsWith('contact:') || saving === p.id}>
                      Load
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Add a real contact, select a primary recipient, then mark drafts send-ready. Emails marked <span className="text-foreground">candidate</span> are not treated as verified.
                  </div>

                  <div className="grid gap-2 md:grid-cols-4">
                    <Input
                      value={(newContactByProspect[p.id]?.fullName ?? '')}
                      onChange={(e) => setNewContactByProspect((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? { fullName: '', title: '', email: '', linkedinUrl: '' }), fullName: e.target.value } }))}
                      placeholder="Full name"
                    />
                    <Input
                      value={(newContactByProspect[p.id]?.title ?? '')}
                      onChange={(e) => setNewContactByProspect((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? { fullName: '', title: '', email: '', linkedinUrl: '' }), title: e.target.value } }))}
                      placeholder="Title (optional)"
                    />
                    <Input
                      value={(newContactByProspect[p.id]?.email ?? '')}
                      onChange={(e) => setNewContactByProspect((prev) => ({ ...prev, [p.id]: { ...(prev[p.id] ?? { fullName: '', title: '', email: '', linkedinUrl: '' }), email: e.target.value } }))}
                      placeholder="Email (optional)"
                      inputMode="email"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving === `contact:create:${p.id}` || !(newContactByProspect[p.id]?.fullName ?? '').trim()}
                        onClick={() => void createContact(p.id)}
                      >
                        Add contact
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving?.startsWith('contact:') || saving === p.id}
                        onClick={() => void loadContacts(p.id)}
                      >
                        Refresh
                      </Button>
                    </div>
                  </div>

                  {(contactsByProspect[p.id] ?? []).length === 0 ? (
                    <div className="text-xs text-muted-foreground">No contacts yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {(contactsByProspect[p.id] ?? []).slice(0, 6).map((c) => (
                        <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-cyan-500/10 bg-background/40 p-2">
                          <div className="min-w-0">
                            <div className="text-sm text-foreground font-medium truncate">
                              {c.full_name}{c.title ? <span className="text-muted-foreground"> · {c.title}</span> : null}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {c.email ? c.email : 'No email'} · status {c.email_status} · confidence {c.confidence_score}/100
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {c.selected_for_outreach ? <Badge variant="outline">Selected</Badge> : null}
                            <Button
                              size="sm"
                              variant={c.selected_for_outreach ? 'default' : 'outline'}
                              disabled={saving === `contact:select:${c.id}`}
                              onClick={() => void selectContact(p.id, c.id)}
                            >
                              {c.selected_for_outreach ? 'Primary' : 'Select'}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {p.drafts.map((d) => (
                    <div key={d.id} className="rounded border border-cyan-500/10 bg-background/30 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-foreground">{d.channel.replace('_', ' ')}</div>
                        <Badge variant="outline" className="text-xs">{d.status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline" className="border-slate-700/60 bg-slate-900/40 text-muted-foreground">
                          Recipient: {d.to_email ? d.to_email : '—'}
                        </Badge>
                        {d.send_ready ? (
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
                            Send-ready
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-700/60 bg-slate-900/40 text-muted-foreground">
                            Not send-ready
                          </Badge>
                        )}
                      </div>
                      {d.subject !== null ? (
                        <Input
                          value={d.subject ?? ''}
                          onChange={(e) => {
                            const v = e.target.value
                            setItems((prev) =>
                              prev.map((pp) =>
                                pp.id === p.id ? { ...pp, drafts: pp.drafts.map((dd) => (dd.id === d.id ? { ...dd, subject: v } : dd)) } : pp
                              )
                            )
                          }}
                          placeholder="Subject"
                        />
                      ) : null}
                      <Textarea
                        value={d.body}
                        onChange={(e) => {
                          const v = e.target.value
                          setItems((prev) =>
                            prev.map((pp) =>
                              pp.id === p.id ? { ...pp, drafts: pp.drafts.map((dd) => (dd.id === d.id ? { ...dd, body: v } : dd)) } : pp
                            )
                          )
                        }}
                        className="min-h-[110px]"
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving === d.id}
                          onClick={() => {
                            void navigator.clipboard.writeText([d.subject ? `Subject: ${d.subject}` : '', d.body].filter(Boolean).join('\n\n'))
                            toast({ title: 'Copied draft' })
                          }}
                        >
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving === d.id}
                          onClick={() => void updateDraft(d.id, { subject: d.subject, body: d.body })}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          className="neon-border hover:glow-effect"
                          disabled={saving === `draft:sendready:${d.id}`}
                          onClick={() => {
                            const selected = (contactsByProspect[p.id] ?? []).find((c) => c.selected_for_outreach) ?? null
                            void setSendReady(d.id, !Boolean(d.send_ready), selected?.id ?? null)
                          }}
                        >
                          {d.send_ready ? 'Unmark send-ready' : 'Mark send-ready'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

