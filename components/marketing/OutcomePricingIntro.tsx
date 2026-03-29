'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export function OutcomePricingIntro() {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        if (fired.current) return
        fired.current = true
        track('pricing_outcome_section_viewed', { section: 'intro' })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <Card ref={ref} className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xl">Choose by outcome</CardTitle>
          <Badge variant="outline" className="li-chip">
            Why-now execution
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          Plans map to how your team runs outbound: validate the loop, execute daily, add deeper context, or standardize across reps.
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">
          Not sure what fits? Start with a sample digest, then pick the workflow you want to operationalize.
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline" className="neon-border hover:glow-effect">
            <Link href="/#try-sample">Generate a sample digest</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tour">Product tour</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

