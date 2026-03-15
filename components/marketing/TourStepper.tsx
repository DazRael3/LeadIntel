'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { TourPreview } from '@/components/marketing/TourPreview'
import { track } from '@/lib/analytics'

type Step = { id: 'icp' | 'accounts' | 'shortlist' | 'score' | 'pitch' | 'saved'; title: string }

const STEPS: Step[] = [
  { id: 'icp', title: 'Define your ICP' },
  { id: 'accounts', title: 'Add target accounts' },
  { id: 'shortlist', title: 'Get a daily shortlist' },
  { id: 'score', title: 'Score + momentum' },
  { id: 'pitch', title: 'Persona-aware outreach' },
  { id: 'saved', title: 'Briefs + operational handoff' },
]

export function TourStepper() {
  const [active, setActive] = useState<Step['id']>('icp')
  const activeIdx = useMemo(() => STEPS.findIndex((s) => s.id === active), [active])

  useEffect(() => {
    track('tour_started', { source: 'marketing', location: '/tour' })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per mount
  }, [])

  useEffect(() => {
    track('tour_step_viewed', { stepId: active })
  }, [active])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-cyan-500/20 bg-card/60 p-3">
          <div className="text-xs text-muted-foreground px-2 py-1">Steps</div>
          <div className="mt-1 flex flex-col">
            {STEPS.map((s, idx) => {
              const isActive = s.id === active
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActive(s.id)}
                  className={
                    'flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ' +
                    (isActive ? 'bg-cyan-500/10 text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-cyan-500/5')
                  }
                  aria-current={isActive ? 'step' : undefined}
                >
                  <span className="font-medium">{`${idx + 1}) ${s.title}`}</span>
                  {isActive ? <span className="text-xs text-cyan-400">Active</span> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Button
            variant="outline"
            disabled={activeIdx <= 0}
            onClick={() => setActive(STEPS[Math.max(0, activeIdx - 1)]!.id)}
          >
            Back
          </Button>
          <Button
            className="neon-border hover:glow-effect"
            onClick={() => {
              const next = STEPS[Math.min(STEPS.length - 1, activeIdx + 1)]!.id
              setActive(next)
              if (next === 'saved') track('tour_completed', { source: 'marketing' })
            }}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <TourPreview stepId={active} />

        {active === 'saved' ? (
          <div className="rounded-xl border border-cyan-500/20 bg-card/60 p-4">
            <div className="text-sm font-semibold text-foreground">Try it now</div>
            <div className="mt-1 text-sm text-muted-foreground">Generate a sample digest, or create an account to use your own watchlist.</div>
            <div className="mt-4 flex flex-col sm:flex-row gap-3">
              <Button asChild className="neon-border hover:glow-effect">
                <Link href="/#try-sample">Generate a sample digest</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/signup?redirect=/onboarding" prefetch={false}>
                  Create your account
                </Link>
              </Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs">
              <Link className="text-cyan-400 hover:underline" href="/templates">
                Browse templates
              </Link>
              <Link className="text-cyan-400 hover:underline" href="/pricing">
                Pricing
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

