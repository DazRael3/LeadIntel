'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { BuildInfo } from '@/lib/debug/buildInfo'

export function BuildDebugPanel({
  tier,
  isHouseCloserOverride,
  buildInfo,
  plan,
  planId,
}: {
  tier: 'starter' | 'closer'
  isHouseCloserOverride: boolean
  buildInfo: BuildInfo | null
  plan: 'free' | 'pro'
  planId: string | null
}) {
  if (!(tier === 'closer' && isHouseCloserOverride)) return null

  const repo =
    buildInfo?.repoOwner && buildInfo?.repoSlug ? `${buildInfo.repoOwner}/${buildInfo.repoSlug}` : 'unknown'
  const branch = buildInfo?.branch ?? 'unknown'
  const commit = buildInfo?.commitSha ? buildInfo.commitSha.slice(0, 7) : 'unknown'

  return (
    <details
      className="w-full max-w-[360px] rounded-md border border-cyan-500/10 bg-card/20 p-2 text-xs text-muted-foreground"
      data-testid="build-debug-panel"
      open={process.env.NODE_ENV === 'test'}
    >
      <summary className="cursor-pointer select-none text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Build debug (House Closer only)
      </summary>
      <div className="mt-2 space-y-1">
        <div>
          <span className="text-muted-foreground/80">Repo:</span> <span className="font-mono">{repo}</span>
        </div>
        <div>
          <span className="text-muted-foreground/80">Branch:</span> <span className="font-mono">{branch}</span>
        </div>
        <div>
          <span className="text-muted-foreground/80">Commit:</span> <span className="font-mono">{commit}</span>
        </div>
        <div>
          <span className="text-muted-foreground/80">Plan:</span>{' '}
          <span className="font-mono">
            tier={tier} plan={plan} planId={planId ?? 'null'} houseOverride={String(isHouseCloserOverride)}
          </span>
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <Button asChild size="sm" variant="outline" className="h-7 px-2 text-[11px]">
          <Link href="/api/plan" target="_blank" rel="noreferrer">
            Open /api/plan
          </Link>
        </Button>
      </div>
    </details>
  )
}

