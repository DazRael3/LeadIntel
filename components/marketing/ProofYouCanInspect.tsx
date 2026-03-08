'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

const ITEMS = [
  { href: '/#try-sample', label: 'Try the no-signup sample digest' },
  { href: '/how-scoring-works', label: 'Review the scoring methodology' },
  { href: '/pricing', label: 'Inspect pricing before booking anything' },
  { href: '/trust', label: 'Check security, privacy, DPA, and status pages' },
  { href: '/templates', label: 'Browse templates and workflow surfaces' },
  { href: '/compare', label: 'Review compare methodology and buyer guidance' },
] as const

export function ProofYouCanInspect() {
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
        track('proof_section_viewed', { section: 'proof_you_can_inspect' })
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <Card ref={ref} className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Proof you can inspect today</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          {ITEMS.map((i) => (
            <li key={i.href}>
              <Link className="text-cyan-300 hover:underline" href={i.href}>
                {i.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button asChild className="neon-border hover:glow-effect">
            <Link href="/#try-sample">Generate a sample digest</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/trust">Trust Center</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

