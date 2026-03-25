'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { track } from '@/lib/analytics'

type StepId = 'icp' | 'accounts' | 'shortlist' | 'score' | 'pitch' | 'saved'

type TourStep = {
  id: StepId
  selector: string
  title: string
  body: string
}

const STEPS: TourStep[] = [
  { id: 'icp', selector: '[data-tour="tour-set-icp"]', title: 'Define your ICP', body: 'Your ICP drives prioritization and targeted drafts.' },
  { id: 'accounts', selector: '[data-tour="tour-add-accounts"]', title: 'Add target accounts', body: 'Your list becomes the daily shortlist.' },
  { id: 'shortlist', selector: '[data-tour="tour-digest-cadence"]', title: 'Daily shortlist', body: 'Start each day with the accounts most worth touching.' },
  { id: 'score', selector: '[data-tour="tour-score-reasons"]', title: 'Score, explained', body: 'See why an account is prioritized—no black box.' },
  { id: 'pitch', selector: '[data-tour="tour-generate-pitch"]', title: 'Instant pitch draft', body: 'Generate a send-ready email or DM in minutes.' },
  { id: 'saved', selector: '[data-tour="tour-saved-outputs"]', title: 'Save and reuse', body: 'Keep outputs so you never start from scratch.' },
]

type StartArgs = { source: 'in_app'; location: string }

type Ctx = {
  startTour: (args: StartArgs) => void
}

const TourContext = createContext<Ctx | null>(null)

const LS_COMPLETED = 'leadintel_tour_completed'
const LS_PROMPTED = 'leadintel_tour_prompted'

export function useInAppTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useInAppTour must be used within InAppTourProvider')
  return ctx
}

export function InAppTourProvider(props: {
  children: React.ReactNode
  autoStartEligible: boolean
  serverTourCompletedAt?: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [idx, setIdx] = useState(0)
  const [startMeta, setStartMeta] = useState<StartArgs | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const skipBtnRef = useRef<HTMLButtonElement | null>(null)
  const backBtnRef = useRef<HTMLButtonElement | null>(null)
  const nextBtnRef = useRef<HTMLButtonElement | null>(null)
  const [highlight, setHighlight] = useState<{ top: number; left: number; width: number; height: number } | null>(null)

  const step = STEPS[idx] ?? STEPS[0]!

  const startTour = useCallback((args: StartArgs) => {
    setStartMeta(args)
    setIdx(0)
    setOpen(true)
    track('tour_started', { source: args.source, location: args.location })
  }, [])

  // Auto-prompt once for new users (localStorage gated).
  useEffect(() => {
    if (!props.autoStartEligible) return
    if (props.serverTourCompletedAt) return
    try {
      const prefersReduced =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      if (prefersReduced) return
      const completed = localStorage.getItem(LS_COMPLETED) === '1'
      if (completed) return
      const prompted = localStorage.getItem(LS_PROMPTED) === '1'
      if (prompted) return
      localStorage.setItem(LS_PROMPTED, '1')
      startTour({ source: 'in_app', location: 'auto_new_user' })
    } catch {
      // ignore
    }
  }, [props.autoStartEligible, props.serverTourCompletedAt, startTour])

  // Positioning + focus + escape handling.
  useEffect(() => {
    if (!open) return
    const el = document.querySelector(step.selector) as HTMLElement | null
    if (el) {
      try {
        el.scrollIntoView({ block: 'center', inline: 'nearest' })
      } catch {
        // ignore
      }
    }
    // Update highlight rectangle (SSR-safe).
    if (el) {
      const rect = el.getBoundingClientRect()
      setHighlight({
        top: Math.max(0, rect.top - 6),
        left: Math.max(0, rect.left - 6),
        width: Math.max(0, rect.width + 12),
        height: Math.max(0, rect.height + 12),
      })
    } else {
      setHighlight(null)
    }

    // Focus the dialog; if that fails, focus the first button.
    dialogRef.current?.focus()
    skipBtnRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        skip()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- depends on open/idx/step
  }, [open, idx])

  useEffect(() => {
    if (!open) return
    track('tour_step_viewed', { stepId: step.id })
  }, [open, step.id])

  const complete = useCallback(async () => {
    setOpen(false)
    try {
      localStorage.setItem(LS_COMPLETED, '1')
    } catch {
      // ignore
    }
    track('tour_completed', { source: startMeta?.source ?? 'in_app' })
    // Best-effort server persistence (requires user session).
    try {
      await fetch('/api/settings/stamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour_completed_at: new Date().toISOString(), onboarding_completed: true }),
      })
    } catch {
      // ignore
    }
    router.refresh()
  }, [router, startMeta?.source])

  const skip = useCallback(() => {
    setOpen(false)
    track('tour_skipped', { source: startMeta?.source ?? 'in_app', stepId: step.id })
  }, [startMeta?.source, step.id])

  const next = useCallback(() => {
    if (idx >= STEPS.length - 1) {
      void complete()
      return
    }
    setIdx((i) => Math.min(STEPS.length - 1, i + 1))
  }, [idx, complete])

  const ctx = useMemo<Ctx>(() => ({ startTour }), [startTour])

  return (
    <TourContext.Provider value={ctx}>
      {props.children}
      {open ? (
        <div className="fixed inset-0 z-[80]" aria-hidden={false}>
          <div className="absolute inset-0 bg-black/55" />
          {highlight ? (
            <div
              className="absolute rounded-lg border border-cyan-500/40 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{
                top: highlight.top,
                left: highlight.left,
                width: highlight.width,
                height: highlight.height,
                background: 'transparent',
              }}
            />
          ) : null}

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Guided tour"
            tabIndex={-1}
            ref={dialogRef}
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return
              // Minimal focus trap: cycle within Skip/Back/Next.
              const order = [skipBtnRef.current, backBtnRef.current, nextBtnRef.current].filter(Boolean) as HTMLElement[]
              if (order.length === 0) return
              const current = document.activeElement
              const idx = order.findIndex((x) => x === current)
              const nextIdx = e.shiftKey ? (idx <= 0 ? order.length - 1 : idx - 1) : (idx >= order.length - 1 ? 0 : idx + 1)
              e.preventDefault()
              order[nextIdx]?.focus()
            }}
            className="absolute left-1/2 top-8 w-[min(720px,92vw)] -translate-x-1/2 rounded-xl border border-cyan-500/20 bg-slate-950/90 backdrop-blur p-4 outline-none"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs text-muted-foreground">
                  Step {idx + 1} of {STEPS.length}
                </div>
                <div className="mt-1 text-base font-semibold text-foreground">{step.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{step.body}</div>
              </div>
              <Button ref={skipBtnRef} variant="outline" size="sm" onClick={skip}>
                Skip
              </Button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-muted-foreground">Press Esc to exit.</div>
              <div className="flex items-center gap-2">
                <Button
                  ref={backBtnRef}
                  variant="outline"
                  onClick={() => setIdx((i) => Math.max(0, i - 1))}
                  disabled={idx === 0}
                >
                  Back
                </Button>
                <Button ref={nextBtnRef} className="neon-border hover:glow-effect" onClick={next}>
                  {idx === STEPS.length - 1 ? 'Done' : 'Next'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </TourContext.Provider>
  )
}

