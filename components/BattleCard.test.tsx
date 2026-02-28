// @vitest-environment jsdom
import React from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

import { BattleCard } from './BattleCard'

describe('BattleCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('renders without crashing when techStack is missing and shows empty state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ ok: true, data: { weakness: 'x', whyBetter: 'y' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }) as unknown as typeof fetch
    )

    render(<BattleCard companyName="Acme" companyUrl="https://acme.com" triggerEvent="Funding" isPro={true} />)

    await waitFor(() => {
      expect(screen.getByText(/no tech stack detected yet/i)).toBeInTheDocument()
    })
  })

  it('renders tech stack badges when array is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ ok: true, data: { techStack: ['React', 'Supabase'], weakness: 'x', whyBetter: 'y' } }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }) as unknown as typeof fetch
    )

    render(<BattleCard companyName="Acme" companyUrl="https://acme.com" triggerEvent="Funding" isPro={true} />)

    expect(await screen.findByText('React')).toBeInTheDocument()
    expect(await screen.findByText('Supabase')).toBeInTheDocument()
  })
})

