'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

export type CompetitiveReportTier = 'starter' | 'closer' | 'closer_plus' | 'team' | null

export function CompetitiveReportViewTracker({
  isLoggedIn,
  tier,
}: {
  isLoggedIn: boolean
  tier: CompetitiveReportTier
}) {
  useEffect(() => {
    track('competitive_report_view', { isLoggedIn, tier })
  }, [isLoggedIn, tier])

  return null
}

export function TrackedButtonLink({
  href,
  label,
  eventName,
  eventProps,
  variant,
  size,
  className,
}: {
  href: string
  label: string
  eventName?: string
  eventProps?: Record<string, unknown>
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  className?: string
}) {
  return (
    <Button asChild variant={variant} size={size} className={className}>
      <Link
        href={href}
        onClick={(e) => {
          if (eventName) track(eventName, eventProps)
          // Avoid noisy JSDOM navigation errors in unit tests.
          if (process.env.NODE_ENV === 'test') {
            e.preventDefault()
          }
        }}
      >
        {label}
      </Link>
    </Button>
  )
}

