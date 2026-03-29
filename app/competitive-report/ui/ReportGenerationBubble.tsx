"use client"

import { useEffect, useMemo, useRef, useState } from 'react'

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

export function ReportGenerationBubble(props: {
  visible: boolean
  startedAtMs: number
  minimized: boolean
  onToggleMinimized: () => void
  onDismiss: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  const rafRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!props.visible) return
    rafRef.current = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      if (rafRef.current) clearInterval(rafRef.current)
      rafRef.current = null
    }
  }, [props.visible])

  const pct = useMemo(() => {
    const elapsed = Math.max(0, now - props.startedAtMs)
    // Expected completion target: 45s. This is an indicator only (not backend-tied).
    return clampPercent((elapsed / 45000) * 100)
  }, [now, props.startedAtMs])

  if (!props.visible) return null

  return (
    <div className="fixed bottom-4 right-4 z-[90]">
      <div className="rounded-full bg-purple-500/30 border border-purple-300/30 shadow-lg backdrop-blur px-4 py-3 flex items-center gap-3">
        <div className="flex flex-col leading-tight">
          <div className="text-xs text-purple-100/90">{props.minimized ? 'Generating…' : 'Report generating'}</div>
          <div className="text-sm font-semibold text-cyan-300 tabular-nums">{pct}%</div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={props.onToggleMinimized}
            className="h-8 px-3 rounded-full text-xs text-purple-50/90 hover:text-purple-50 hover:bg-purple-500/20 transition"
          >
            {props.minimized ? 'Expand' : 'Minimize'}
          </button>
          <button
            type="button"
            onClick={props.onDismiss}
            className="h-8 px-3 rounded-full text-xs text-purple-50/90 hover:text-purple-50 hover:bg-purple-500/20 transition"
            aria-label="Dismiss"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

