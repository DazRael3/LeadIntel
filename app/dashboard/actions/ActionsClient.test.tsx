// @vitest-environment jsdom
import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ActionsClient } from './ActionsClient'

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

vi.mock('@/components/collab/CommentThreadPanel', () => ({
  CommentThreadPanel: () => null,
}))

vi.mock('@/components/account/LeadAiPitchPanel', () => ({
  LeadAiPitchPanel: () => null,
}))

vi.mock('@/components/dashboard/OutboundExecutionPanel', () => ({
  OutboundExecutionPanel: () => null,
}))

vi.mock('@/components/ui/card', () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
}))

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
}))

function renderClient(): void {
  render(<ActionsClient />)
}

describe('ActionsClient queue fallback states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty queue state for 200 with no items', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            items: [],
            meta: { state: 'empty', reason: 'no_actions' },
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    ) as unknown as typeof fetch

    renderClient()

    await waitFor(() => {
      expect(screen.getByTestId('actions-queue-fallback')).toBeInTheDocument()
    })
    expect(screen.getByText('No queued actions yet.')).toBeInTheDocument()
  })

  it('renders upgrade state for 200 upgrade_required payload (no crash)', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            items: [],
            meta: { state: 'upgrade_required', reason: 'capability_denied' },
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    ) as unknown as typeof fetch

    renderClient()

    await waitFor(() => {
      expect(screen.getByTestId('actions-queue-fallback')).toBeInTheDocument()
    })
    expect(screen.getByText('This workspace does not have access to action queues yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeInTheDocument()
  })

  it('renders restricted state cleanly on 403 response', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'FORBIDDEN', message: 'Access restricted' },
        }),
        {
          status: 403,
          headers: { 'content-type': 'application/json' },
        }
      )
    ) as unknown as typeof fetch

    renderClient()

    await waitFor(() => {
      expect(screen.getByTestId('actions-queue-fallback')).toBeInTheDocument()
    })
    expect(screen.getByText('This workspace does not have access to action queues yet.')).toBeInTheDocument()
  })

  it('renders unauthorized state cleanly on 401 response', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
        }),
        {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }
      )
    ) as unknown as typeof fetch

    renderClient()

    await waitFor(() => {
      expect(screen.getByTestId('actions-queue-fallback')).toBeInTheDocument()
    })
    expect(screen.getByText('Sign in again to view workspace actions.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it('renders unavailable fallback for malformed payloads (no crash)', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    ) as unknown as typeof fetch

    renderClient()

    await waitFor(() => {
      expect(screen.getByTestId('actions-queue-fallback')).toBeInTheDocument()
    })
    expect(screen.getByText('Action queue is temporarily unavailable.')).toBeInTheDocument()
  })
})
