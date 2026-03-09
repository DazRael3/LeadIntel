'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { ObservedVsInferredCallout } from '@/components/revenue/ObservedVsInferredCallout'

type Plan = {
  confidence: 'limited' | 'usable' | 'strong'
  reasonSummary: string
  stakeholderPath: Array<{ persona: string; why: string; limitations: string[] }>
  timeline: Array<{ when: 'now' | 'next' | 'later' | 'wait'; label: string; rationale: string; persona: string | null; caution: string | null }>
  whatWouldMakeThisStronger: string[]
  limitationsNote: string | null
}

type Follow = { followThrough: string; blockers: string[] }

type Envelope =
  | { ok: true; data: { plan: Plan; followThrough: Follow } }
  | { ok: false; error?: { message?: string } }

export function AccountPlanCard(props: { accountId: string; window: '7d' | '30d' | '90d' | 'all' }) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [follow, setFollow] = useState<Follow | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      qs.set('window', props.window)
      const res = await fetch(`/api/accounts/${encodeURIComponent(props.accountId)}/plan?${qs.toString()}`, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as Envelope | null
      if (!res.ok || !json || json.ok !== true) {
        setPlan(null)
        setFollow(null)
        return
      }
      setPlan(json.data.plan)
      setFollow(json.data.followThrough)
    } catch {
      setPlan(null)
      setFollow(null)
      toast({ variant: 'destructive', title: 'Plan unavailable', description: 'Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [props.accountId, props.window, toast])

  useEffect(() => {
    void load()
  }, [load])

  const confBadge = useMemo(() => {
    if (!plan) return null
    const cls =
      plan.confidence === 'strong'
        ? 'border-emerald-500/30 text-emerald-200 bg-emerald-500/10'
        : plan.confidence === 'usable'
          ? 'border-cyan-500/30 text-cyan-200 bg-cyan-500/10'
          : 'border-yellow-500/30 text-yellow-200 bg-yellow-500/10'
    return { cls, label: plan.confidence === 'strong' ? 'Strong' : plan.confidence === 'usable' ? 'Usable' : 'Limited' }
  }, [plan])

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Account plan</CardTitle>
          <div className="flex items-center gap-2">
            {confBadge ? (
              <Badge variant="outline" className={confBadge.cls}>
                {confBadge.label}
              </Badge>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {loading ? (
          <div>Loading…</div>
        ) : !plan ? (
          <div className="text-xs text-muted-foreground">Planning guidance is not available yet.</div>
        ) : (
          <>
            <div className="text-foreground font-medium">{plan.reasonSummary}</div>
            <ObservedVsInferredCallout />

            {follow && (follow.blockers?.length ?? 0) > 0 ? (
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Follow-through:</span> {follow.blockers.slice(0, 2).join(' ')}
              </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(plan.timeline ?? []).slice(0, 4).map((s) => (
                <div key={`${s.when}:${s.label}`} className="rounded border border-cyan-500/10 bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-foreground font-medium">{s.label}</div>
                    <Badge variant="outline" className="border-cyan-500/20 text-muted-foreground bg-muted/20">
                      {s.when}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.rationale}</div>
                  {s.persona ? <div className="mt-1 text-xs text-muted-foreground">Persona: {s.persona}</div> : null}
                  {s.caution ? <div className="mt-2 text-xs text-yellow-200">{s.caution}</div> : null}
                </div>
              ))}
            </div>

            {plan.stakeholderPath.length > 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                <div className="text-foreground font-medium">Stakeholder path</div>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {plan.stakeholderPath.slice(0, 3).map((p) => (
                    <li key={p.persona}>
                      <span className="text-foreground font-medium">{p.persona}:</span> {p.why}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan.whatWouldMakeThisStronger.length > 0 ? (
              <div className="rounded border border-cyan-500/10 bg-background/40 p-3 text-xs text-muted-foreground">
                <div className="text-foreground font-medium">What would make this stronger</div>
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {plan.whatWouldMakeThisStronger.slice(0, 3).map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {plan.limitationsNote ? (
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs text-muted-foreground">
                <span className="text-foreground font-medium">Caution:</span> {plan.limitationsNote}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

