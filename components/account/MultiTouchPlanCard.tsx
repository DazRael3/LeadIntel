'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

type Step = { step: string; label: string; persona: string | null; rationale: string; caution: string | null }
type TouchPlan = { steps: Step[]; limitationsNote: string | null; confidence: 'limited' | 'usable' | 'strong' }
type Envelope = { ok: true; data: { touchPlan: TouchPlan } } | { ok: false; error?: { message?: string } }

export function MultiTouchPlanCard(props: { accountId: string; window: '7d' | '30d' | '90d' | 'all' }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [tp, setTp] = useState<TouchPlan | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('window', props.window)
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/touch-plan?${qs.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setTp(null)
        return
      }
      setTp(json.data.touchPlan)
    } catch {
      setTp(null)
      toast({ variant: 'destructive', title: 'Touch plan unavailable', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [props.accountId, props.window, toast])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Multi-touch plan</CardTitle>
          <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading ? (
          <div>Loading…</div>
        ) : !tp ? (
          <div className="text-xs text-muted-foreground">No multi-touch plan yet.</div>
        ) : (
          <>
            <div className="space-y-2">
              {tp.steps.slice(0, 4).map((s) => (
                <div key={s.step} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-foreground font-medium">{s.label}</div>
                    <Badge variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                      {s.step}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.rationale}</div>
                  {s.persona ? <div className="mt-1 text-xs text-muted-foreground">Persona: {s.persona}</div> : null}
                  {s.caution ? <div className="mt-2 text-xs text-yellow-200">{s.caution}</div> : null}
                </div>
              ))}
            </div>
            {tp.limitationsNote ? (
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Caution:</span> {tp.limitationsNote}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

