'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { track } from '@/lib/analytics'

type OutcomeKind =
  | 'no_outcome_yet'
  | 'replied'
  | 'meeting_booked'
  | 'qualified'
  | 'opportunity_created'
  | 'not_a_fit'
  | 'wrong_timing'
  | 'no_response'
  | 'manual_dismissal'
  | 'converted_yes'
  | 'converted_no'

type OutcomeRow = { id: string; outcome: OutcomeKind; recorded_at: string; note: string | null }

type GetEnvelope =
  | { ok: true; data: { rows: OutcomeRow[] } }
  | { ok: false; error?: { message?: string } }

const OUTCOME_LABEL: Record<OutcomeKind, string> = {
  no_outcome_yet: 'No outcome yet',
  replied: 'Replied',
  meeting_booked: 'Meeting booked',
  qualified: 'Qualified',
  opportunity_created: 'Opportunity created',
  not_a_fit: 'Not a fit',
  wrong_timing: 'Wrong timing',
  no_response: 'No response',
  manual_dismissal: 'Dismissed',
  converted_yes: 'Converted (Yes)',
  converted_no: 'Converted (No)',
}

export function OutcomeTracker(props: { accountId: string }) {
  const { toast } = useToast()
  const [rows, setRows] = useState<OutcomeRow[]>([])
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState<OutcomeKind>('no_outcome_yet')

  async function load() {
    const qs = new URLSearchParams()
    qs.set('accountId', props.accountId)
    const res = await fetch(`/api/outcomes?${qs.toString()}`, { cache: 'no-store' })
    const json = (await res.json().catch(() => null)) as GetEnvelope | null
    if (!res.ok || !json || json.ok !== true) return
    setRows(json.data.rows ?? [])
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.accountId])

  const latest = useMemo(() => rows[0] ?? null, [rows])

  async function save() {
    setSaving(true)
    try {
      track('outcome_recorded', { accountId: props.accountId, outcome: selected })
      const res = await fetch('/api/outcomes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accountId: props.accountId, outcome: selected }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        toast({ variant: 'destructive', title: 'Save failed', description: json?.error?.message ?? 'Please try again.' })
        return
      }
      toast({ title: 'Outcome saved.' })
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Outcome</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {latest ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{OUTCOME_LABEL[latest.outcome]}</Badge>
            <span className="text-xs text-muted-foreground">last updated {new Date(latest.recorded_at).toLocaleString()}</span>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No outcomes recorded yet.</div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value as OutcomeKind)}
            disabled={saving}
          >
            {(Object.keys(OUTCOME_LABEL) as OutcomeKind[]).map((k) => (
              <option key={k} value={k}>
                {OUTCOME_LABEL[k]}
              </option>
            ))}
          </select>
          <Button className="neon-border hover:glow-effect" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save outcome'}
          </Button>
          <Button variant="outline" disabled={saving} onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <div className="rounded border border-cyan-500/10 bg-background/30 p-2">
          <div className="text-xs text-muted-foreground mb-2">Did this lead convert?</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setSelected('converted_yes')
                void save()
              }}
            >
              Yes
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => {
                setSelected('converted_no')
                void save()
              }}
            >
              No
            </Button>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Outcomes are operator-entered. LeadIntel does not claim automatic attribution or causation.
        </div>
      </CardContent>
    </Card>
  )
}

