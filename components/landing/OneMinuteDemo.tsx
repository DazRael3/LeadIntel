'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DemoLoop } from '@/components/landing/DemoLoop'

type AssetKind = 'mp4' | 'gif' | 'none'

export function OneMinuteDemo() {
  const [stage, setStage] = useState<AssetKind>('mp4')

  const asset: { kind: AssetKind; src: string } = useMemo(() => {
    if (stage === 'gif') return { kind: 'gif', src: '/demo.gif' }
    if (stage === 'mp4') return { kind: 'mp4', src: '/demo.mp4' }
    return { kind: 'none', src: '' }
  }, [stage])

  const showAsset = asset.kind !== 'none'

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
                onError={() => setStage('gif')}
                className="w-full h-auto"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- optional marketing asset
              <img
                src={asset.src}
                alt="LeadIntel demo"
                onError={() => setStage('none')}
                className="w-full h-auto"
              />
            )}
          </div>
        ) : (
          <div className="rounded border border-cyan-500/20 bg-background/50 p-4">
            <DemoLoop />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

