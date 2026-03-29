'use client'

import type { ComponentType, RefObject } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { Badge } from '@/components/ui/badge'
import { track } from '@/lib/analytics'
import { ArrowUpRight, ClipboardList, FileText, Workflow } from 'lucide-react'

type ProofItem = {
  key: 'daily_shortlist' | 'explainable_score' | 'send_ready_drafts' | 'actions'
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
}

const ITEMS: ProofItem[] = [
  {
    key: 'daily_shortlist',
    label: 'Daily shortlist',
    description: 'A ranked, focused list of accounts to action today.',
    icon: ClipboardList,
  },
  {
    key: 'explainable_score',
    label: 'Explainable score',
    description: 'Deterministic 0–100 scoring with visible reasons.',
    icon: ArrowUpRight,
  },
  {
    key: 'send_ready_drafts',
    label: 'Send-ready drafts',
    description: 'Email + DM + call openers generated from timing and ICP.',
    icon: FileText,
  },
  {
    key: 'actions',
    label: 'Webhook + export actions',
    description: 'Push or export the action layer to your existing workflow.',
    icon: Workflow,
  },
]

function useInViewOnce(onView: () => void): RefObject<HTMLDivElement> {
  const ref = useRef<HTMLDivElement | null>(null)
  const fired = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (fired.current) return

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((e) => e.isIntersecting)
        if (!visible) return
        if (fired.current) return
        fired.current = true
        onView()
      },
      { threshold: 0.35 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [onView])

  return ref as RefObject<HTMLDivElement>
}

export function ProofStrip() {
  const payload = useMemo(() => ({ items: ITEMS.map((i) => i.key) }), [])
  const ref = useInViewOnce(() => track('marketing_proof_strip_viewed', payload))

  return (
    <div ref={ref} className="rounded-xl border border-cyan-500/20 bg-card/50">
      <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold text-foreground">Proof strip</div>
        <Badge
          variant="outline"
          className="w-fit border-cyan-500/30 bg-cyan-500/10 text-cyan-800 dark:text-cyan-300"
        >
          Evidence, not hype
        </Badge>
      </div>
      <div className="grid grid-cols-1 gap-3 px-4 pb-4 md:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((i) => {
          const Icon = i.icon
          return (
            <div key={i.key} className="rounded-lg border border-cyan-500/10 bg-background/40 px-3 py-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-cyan-400" />
                <div className="text-sm font-semibold text-foreground">{i.label}</div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{i.description}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

