'use client'

import { Button } from "@/components/ui/button"
import { Lock, DollarSign } from "lucide-react"
import { useRouter } from "next/navigation"
import { COPY } from "@/lib/copy/leadintel"

export function UpgradeOverlay() {
  const router = useRouter()

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/90 backdrop-blur-sm rounded-lg border border-cyan-500/30">
      <div className="text-center p-4">
        <Lock className="h-8 w-8 mx-auto mb-3 text-cyan-400" />
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{COPY.gates.label}</p>
        <p className="text-sm font-bold mb-2 text-cyan-400">{COPY.gates.title}</p>
        <p className="text-xs text-muted-foreground mb-3">{COPY.gates.body}</p>
        <p className="text-[11px] text-muted-foreground mb-3">
          Unlock path: Closer or higher. Continue in Dashboard if you are not upgrading now.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button
            size="sm"
            onClick={() => router.push('/pricing?target=closer')}
            className="neon-border hover:glow-effect bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
          >
            <DollarSign className="h-4 w-4 mr-2" />
            {COPY.gates.ctaPrimary}
          </Button>
          <Button size="sm" variant="outline" onClick={() => router.push('/pricing')}>
            {COPY.gates.ctaSecondary}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => router.push('/dashboard')}>
            Continue in Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}
