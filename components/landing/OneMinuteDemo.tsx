'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DemoLoop } from '@/components/landing/DemoLoop'

type AssetKind = 'mp4' | 'gif' | 'none'

export function OneMinuteDemo() {
  const [broken, setBroken] = useState(false)

  const asset: { kind: AssetKind; src: string } = useMemo(() => {
    // Prefer mp4 if present at /public/demo.mp4 (or replace with demo.gif).
    // If you add an asset, keep the filename stable so we don’t need code changes.
    return { kind: 'mp4', src: '/demo.mp4' }
  }, [])

  const showAsset = !broken && asset.kind !== 'none'

  return (
    <Card className="border-cyan-500/20 bg-card/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">1-minute demo</CardTitle>
        <p className="text-xs text-muted-foreground">Enter ICP → see digest → generate pitch.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {showAsset ? (
          <div className="rounded border border-cyan-500/20 bg-background/50 overflow-hidden">
            {asset.kind === 'mp4' ? (
              <video
                src={asset.src}
                autoPlay
                muted
                loop
                playsInline
                controls={false}
                onError={() => setBroken(true)}
                className="w-full h-auto"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- optional marketing asset
              <img
                src={asset.src}
                alt="LeadIntel demo"
                onError={() => setBroken(true)}
                className="w-full h-auto"
              />
            )}
          </div>
        ) : (
          <div className="rounded border border-cyan-500/20 bg-background/50 p-4">
            {/* TODO(marketing): Add /public/demo.mp4 (preferred) or /public/demo.gif and this will auto-render. */}
            <div className="text-xs text-muted-foreground">
              Demo asset not found. Showing a lightweight UI simulation instead.
            </div>
            <div className="mt-3">
              <DemoLoop />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

