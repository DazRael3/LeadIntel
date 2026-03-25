'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[dashboard-error] unhandled error', { message: props.error?.message })
    }
  }, [props.error])

  return (
    <div className="px-4 py-10">
      <Card className="border-cyan-500/20 bg-card/60 max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl bloomberg-font neon-cyan">Dashboard unavailable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            This page hit an unexpected error. Your session is still safe. You can retry, or use one of the safe routes
            below.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="neon-border hover:glow-effect" onClick={() => props.reset()}>
              Retry
            </Button>
            <Button asChild variant="outline">
              <Link href="/pricing">Pricing</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/support">Support</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

