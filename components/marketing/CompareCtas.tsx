'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export function CompareCtas(props: { slug: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button asChild className="neon-border hover:glow-effect" onClick={() => track('compare_cta_try_sample_clicked', { slug: props.slug })}>
        <Link href="/#try-sample">Generate a sample digest</Link>
      </Button>
      <Button
        asChild
        variant="outline"
        onClick={() => track('compare_cta_pricing_clicked', { slug: props.slug })}
      >
        <Link href="/pricing">See pricing</Link>
      </Button>
    </div>
  )
}

