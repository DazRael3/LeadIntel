'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type OpportunityContext = {
  type: 'opportunity_context'
  version: string
  workspaceId: string
  accountId: string
  accountMapping: { verificationStatus: string; crmObjectId: string } | null
  opportunities: Array<{ id: string; crmObjectId: string; verificationStatus: string; status: string }>
  latestObservation: { observedAt: string; opportunityId: string; stage: string | null; status: string | null; source: string; evidenceNote: string | null } | null
  verification: { label: string; note: string }
  limitationsNote: string
  computedAt: string
}

type Envelope =
  | { ok: true; data: OpportunityContext }
  | { ok: false; error?: { message?: string } }

function mask(id: string): string {
  const v = id.trim()
  if (v.length <= 8) return v
  return `${v.slice(0, 4)}…${v.slice(-4)}`
}

export function OpportunityContextCard(props: { accountId: string }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [ctx, setCtx] = useState<OpportunityContext | null>(null)
  const [saving, setSaving] = useState(false)
  const [crmAccountId, setCrmAccountId] = useState('')
  const [crmOpportunityId, setCrmOpportunityId] = useState('')
  const [oppStage, setOppStage] = useState('')
  const [oppStatus, setOppStatus] = useState('')
  const [evidenceNote, setEvidenceNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/accounts/${props.accountId}/opportunity-context`, { cache: 'no-store', credentials: 'include' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setCtx(null)
        return
      }
      setCtx(json.data)
      track('opportunity_context_viewed', { accountId: props.accountId })
    } catch {
      setCtx(null)
    } finally {
      setLoading(false)
    }
  }, [props.accountId])

  useEffect(() => {
    void load()
  }, [load])

  async function saveAccountMapping() {
    if (!crmAccountId.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/crm/mappings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId: props.accountId,
          mappingKind: 'account',
          crmSystem: 'generic',
          crmObjectId: crmAccountId.trim(),
          status: 'mapped',
          verificationStatus: 'needs_review',
          reason: 'Manual mapping created in LeadIntel.',
        }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Please check the ID and try again.' })
        return
      }
      toast({ variant: 'success', title: 'Saved', description: 'CRM account mapping recorded.' })
      setCrmAccountId('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function saveOpportunityMapping() {
    if (!crmOpportunityId.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/crm/mappings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId: props.accountId,
          mappingKind: 'opportunity',
          crmSystem: 'generic',
          crmObjectId: crmOpportunityId.trim(),
          status: 'mapped',
          verificationStatus: 'needs_review',
          reason: 'Manual mapping created in LeadIntel.',
        }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Please check the ID and try again.' })
        return
      }
      toast({ variant: 'success', title: 'Saved', description: 'Opportunity mapping recorded.' })
      setCrmOpportunityId('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  async function recordObservation() {
    if (!crmOpportunityId.trim()) {
      toast({ variant: 'destructive', title: 'Missing opportunity id', description: 'Enter an opportunity ID first.' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/crm/observations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId: props.accountId,
          crmSystem: 'generic',
          opportunityId: crmOpportunityId.trim(),
          stage: oppStage.trim() ? oppStage.trim() : null,
          status: oppStatus.trim() ? oppStatus.trim() : null,
          evidenceNote: evidenceNote.trim() ? evidenceNote.trim() : null,
        }),
      })
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Save failed', description: 'Please try again.' })
        return
      }
      toast({ variant: 'success', title: 'Saved', description: 'CRM observation recorded.' })
      setEvidenceNote('')
      setOppStage('')
      setOppStatus('')
      await load()
    } finally {
      setSaving(false)
    }
  }

  const hasAny = Boolean(ctx?.accountMapping || (ctx?.opportunities?.length ?? 0) > 0 || ctx?.latestObservation)

  const statusBadge = useMemo(() => {
    const label = ctx?.verification?.label ?? 'insufficient_evidence'
    const tone =
      label === 'verified' ? 'border-green-500/30 text-green-300 bg-green-500/10' : label === 'ambiguous' ? 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10' : 'border-cyan-500/20'
    return { label: label.replaceAll('_', ' '), tone }
  }, [ctx?.verification?.label])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Opportunity context</CardTitle>
          {ctx ? (
            <Badge variant="outline" className={statusBadge.tone}>
              {statusBadge.label}
            </Badge>
          ) : (
            <Badge variant="outline">Unavailable</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading ? <div>Loading…</div> : null}

        {!loading && !ctx ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            Revenue intelligence is unavailable for this workspace or plan.
          </div>
        ) : null}

        {!loading && ctx && !hasAny ? (
          <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
            <div className="text-sm font-semibold text-foreground">No CRM context</div>
            <div className="mt-1 text-xs text-muted-foreground">{ctx.limitationsNote}</div>
            <div className="mt-3">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <Input value={crmAccountId} onChange={(e) => setCrmAccountId(e.target.value)} placeholder="CRM account id" />
                <Button size="sm" variant="outline" onClick={() => void saveAccountMapping()} disabled={saving || crmAccountId.trim().length === 0}>
                  Save mapping
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {!loading && ctx && hasAny ? (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">CRM account mapping</div>
                <div className="mt-2 text-sm text-foreground">
                  {ctx.accountMapping ? <span className="font-mono">{mask(ctx.accountMapping.crmObjectId)}</span> : <span className="text-muted-foreground">Not mapped</span>}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{ctx.accountMapping ? `Status: ${ctx.accountMapping.verificationStatus}` : 'Add an explicit mapping to enable downstream context.'}</div>
              </div>
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Opportunity mappings</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(ctx.opportunities ?? []).slice(0, 3).map((o) => (
                    <Badge key={o.id} variant="outline">
                      {mask(o.crmObjectId)}
                    </Badge>
                  ))}
                  {(ctx.opportunities ?? []).length === 0 ? <span className="text-xs text-muted-foreground">None</span> : null}
                </div>
              </div>
            </div>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Latest observed CRM update</div>
              {ctx.latestObservation ? (
                <div className="mt-2 space-y-1">
                  <div className="text-sm text-foreground">
                    Opportunity <span className="font-mono">{mask(ctx.latestObservation.opportunityId)}</span>
                    {ctx.latestObservation.stage ? ` · stage ${ctx.latestObservation.stage}` : ''}
                    {ctx.latestObservation.status ? ` · ${ctx.latestObservation.status}` : ''}
                  </div>
                  <div className="text-xs text-muted-foreground">Observed at {new Date(ctx.latestObservation.observedAt).toLocaleString()} · source {ctx.latestObservation.source}</div>
                  {ctx.latestObservation.evidenceNote ? <div className="text-xs text-muted-foreground">Note: {ctx.latestObservation.evidenceNote}</div> : null}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">No observations recorded yet.</div>
              )}
            </div>

            <div className="text-xs text-muted-foreground">{ctx.limitationsNote}</div>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Add / update mapping</div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <Input value={crmAccountId} onChange={(e) => setCrmAccountId(e.target.value)} placeholder="CRM account id" />
                <Button size="sm" variant="outline" onClick={() => void saveAccountMapping()} disabled={saving || crmAccountId.trim().length === 0}>
                  Save account mapping
                </Button>
                <Input value={crmOpportunityId} onChange={(e) => setCrmOpportunityId(e.target.value)} placeholder="CRM opportunity id" />
                <Button size="sm" variant="outline" onClick={() => void saveOpportunityMapping()} disabled={saving || crmOpportunityId.trim().length === 0}>
                  Save opportunity mapping
                </Button>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">Mappings are explicit and may require verification.</div>
            </div>

            <div className="rounded border border-cyan-500/10 bg-background/40 p-3">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Record CRM observation</div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                <Input value={oppStage} onChange={(e) => setOppStage(e.target.value)} placeholder="Stage (optional)" />
                <Input value={oppStatus} onChange={(e) => setOppStatus(e.target.value)} placeholder="Status (optional)" />
              </div>
              <div className="mt-2">
                <Textarea value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="Evidence note (optional, no secrets)." />
              </div>
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={() => void recordObservation()} disabled={saving || crmOpportunityId.trim().length === 0}>
                  Record observation for {crmOpportunityId.trim() ? mask(crmOpportunityId) : 'opportunity'}
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

