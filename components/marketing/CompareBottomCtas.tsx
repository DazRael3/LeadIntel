'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export function CompareBottomCtas(props: { slug: string }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      <Button
        asChild
        className="neon-border hover:glow-effect"
        onClick={() => track('compare_cta_try_sample_clicked', { slug: props.slug, location: 'bottom' })}
      >
        <Link href="/#try-sample">Generate a sample digest</Link>
      </Button>
      <Button asChild variant="outline">
        <Link href="/templates">Browse templates</Link>
      </Button>
    </div>
  )
}

