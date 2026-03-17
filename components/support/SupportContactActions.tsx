'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export function SupportContactActions(props: { mailto: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button
        asChild
        size="sm"
        className="w-full sm:w-auto min-h-10 neon-border hover:glow-effect"
        onClick={() => track('support_cta_clicked', { cta: 'email' })}
      >
        <a href={props.mailto}>Email support</a>
      </Button>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="w-full sm:w-auto min-h-10"
        onClick={() => track('support_cta_clicked', { cta: 'pricing' })}
      >
        <Link href="/pricing">View pricing</Link>
      </Button>
      <Button
        asChild
        size="sm"
        variant="outline"
        className="w-full sm:w-auto min-h-10"
        onClick={() => track('support_cta_clicked', { cta: 'dashboard' })}
      >
        <Link href="/dashboard" prefetch={false}>
          Go to dashboard
        </Link>
      </Button>
    </div>
  )
}

