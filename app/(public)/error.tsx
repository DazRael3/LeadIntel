'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { TopNav } from '@/components/TopNav'
import { SiteFooter } from '@/components/SiteFooter'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function PublicError(props: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[public-error] unhandled error', { message: props.error?.message })
    }
  }, [props.error])

  return (
    <div className="min-h-screen bg-background terminal-grid flex flex-col">
      <TopNav />
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <Card className="border-cyan-500/20 bg-card/60 max-w-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-2xl bloomberg-font neon-cyan">This page is temporarily unavailable</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>Try again, or use one of the safe routes below.</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button className="neon-border hover:glow-effect" onClick={props.reset}>
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
      <SiteFooter />
    </div>
  )
}

