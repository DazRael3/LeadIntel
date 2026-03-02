'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ActivationGoalCard(props: { totalLeads: number }) {
  const remaining = Math.max(0, 10 - props.totalLeads)
  if (props.totalLeads >= 10) return null

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Your fastest path to value</CardTitle>
        <div className="text-xs text-muted-foreground">
          The “aha moment” is receiving your first Daily Digest email after adding 10–25 accounts.
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <ol className="list-decimal pl-5 space-y-1">
          <li>Add 10 target accounts (you’re {remaining} away).</li>
          <li>Generate 1 pitch to validate messaging.</li>
          <li>Enable your Daily Digest email in Settings.</li>
        </ol>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Button asChild size="sm" className="w-full sm:w-auto neon-border hover:glow-effect">
            <Link href="/dashboard">Add accounts</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard">Open Settings</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

