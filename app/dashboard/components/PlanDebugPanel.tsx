'use client'

import React from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePlan } from '@/components/PlanProvider'

export function PlanDebugPanel() {
  const { tier, planId, isHouseCloserOverride } = usePlan()

  if (!(tier === 'closer' && isHouseCloserOverride)) return null

  return (
    <Card className="mt-8 border-cyan-500/10 bg-card/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Plan debug (house closer)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-xs text-muted-foreground">
        <pre className="whitespace-pre-wrap rounded-md border border-cyan-500/10 bg-background/30 p-3 font-mono">
          {JSON.stringify({ tier, planId, isHouseCloserOverride }, null, 2)}
        </pre>
        <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
          <Link href="/api/plan" target="_blank" rel="noreferrer">
            Open /api/plan
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

