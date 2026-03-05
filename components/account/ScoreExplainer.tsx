'use client'

import * as React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { ScoreExplainability } from '@/lib/domain/explainability'

export function ScoreExplainer(props: { explainability: ScoreExplainability | null; loading?: boolean }) {
  const { toast } = useToast()

  const score = props.explainability?.score
  const reasons = props.explainability?.reasons ?? []
  const breakdown = props.explainability?.breakdown

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Score, explained</CardTitle>
          {typeof score === 'number' ? <Badge variant="outline">{score}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-4">
        {props.loading ? (
          <div className="text-xs text-muted-foreground">Loading score details…</div>
        ) : !props.explainability ? (
          <div className="text-xs text-muted-foreground">Score details aren’t available.</div>
        ) : (
          <>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Why this score</div>
              {reasons.length > 0 ? (
                <ul className="mt-2 list-disc pl-5 space-y-1">
                  {reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">Score reasons aren’t available for this account yet.</div>
              )}
              {reasons.length > 0 ? (
                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={async () => {
                      const text = reasons.join('\n')
                      await navigator.clipboard.writeText(text)
                      toast({ title: 'Copied score reasons', description: 'You can paste these into notes or a CRM.' })
                    }}
                  >
                    Copy reasons
                  </Button>
                </div>
              ) : null}
            </div>

            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Breakdown</div>
              {Array.isArray(breakdown) && breakdown.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {breakdown.map((b) => (
                    <div key={b.label} className="flex items-center justify-between rounded border border-cyan-500/10 bg-background/40 px-3 py-2">
                      <div className="text-sm text-foreground">{b.label}</div>
                      <Badge variant="outline">{b.points}</Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted-foreground">Score breakdown not available for this account yet.</div>
              )}
            </div>

            <div className="text-xs">
              <Link className="text-cyan-400 hover:underline" href="/how-scoring-works">
                Learn how scoring works
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

