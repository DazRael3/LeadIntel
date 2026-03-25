'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function RootError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Best-effort logging; do not dump stacks or secrets.
    if (process.env.NODE_ENV === 'development') {
      console.error('[root-error] unhandled error', { message: props.error?.message })
    }
  }, [props.error])

  return (
    <div className="min-h-screen bg-background terminal-grid flex items-center justify-center px-4 py-12">
      <Card className="border-cyan-500/20 bg-card/60 w-full max-w-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-2xl bloomberg-font neon-cyan">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The page hit an unexpected error. You can retry, or use one of the safe routes below.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button className="neon-border hover:glow-effect" onClick={() => props.reset()}>
              Retry
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/support">Support</Link>
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            If this keeps happening, contact support with the approximate time and route you visited.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

