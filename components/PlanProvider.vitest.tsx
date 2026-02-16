// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

import { PlanProvider, usePlan } from './PlanProvider'

function Consumer() {
  const { tier } = usePlan()
  return <div data-testid="tier">{tier}</div>
}

describe('PlanProvider / usePlan', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('usePlan() outside PlanProvider returns starter fallback (does not throw)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(<Consumer />)
    expect(screen.getByTestId('tier').textContent).toBe('starter')
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[PlanProvider] usePlan called outside of PlanProvider')
    )
  })

  it('PlanProvider refresh hydrates tier from /api/plan (legacy team -> closer)', async () => {
    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          ok: true,
          data: { plan: 'pro', tier: 'team', planId: 'team', trial: { active: false, endsAt: null } },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    })
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch)

    render(
      <PlanProvider initialPlan="free">
        <Consumer />
      </PlanProvider>
    )

    await act(async () => {
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/plan', expect.any(Object))
    expect(screen.getByTestId('tier').textContent).toBe('closer')
  })
})

