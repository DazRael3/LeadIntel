// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/components/mobile/MobileActionSheet', () => ({
  MobileActionSheet: (props: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) => {
    if (!props.open) return null
    return <div data-testid="mobile-sheet">{props.children}</div>
  },
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

vi.mock('@/lib/analytics', () => ({
  track: vi.fn(),
}))

describe('AssistantPanel request discipline', () => {
  it('locks after 403 and stops sending', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      if (String(url).includes('/api/assistant/suggested-prompts')) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: { scope: 'workspace', prompts: [] },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (String(url).includes('/api/assistant/chat')) {
        return new Response(JSON.stringify({ ok: false, error: { code: 'ASSISTANT_PLAN_REQUIRED', message: 'Upgrade required.' } }), { status: 403 })
      }
      return new Response(JSON.stringify({ ok: false, error: { code: 'UNKNOWN', message: 'nope' } }), { status: 500 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { AssistantPanel } = await import('./AssistantPanel')
    render(<AssistantPanel open={true} onClose={() => {}} scope={{ type: 'workspace', id: null }} title="Assistant" />)

    // Prompts fetch should happen once on open.
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const textarea = (await screen.findAllByPlaceholderText('Ask… (grounded to this scope)'))[0]
    const sendBtn = screen.getAllByRole('button', { name: 'Send' })[0]

    // First send triggers chat (403), which should lock the panel.
    fireEvent.change(textarea, { target: { value: 'Can you help?' } })
    fireEvent.click(sendBtn)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // Second attempt should not issue a new chat request once locked.
    fireEvent.change(textarea, { target: { value: 'Retry question' } })
    fireEvent.click(sendBtn)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

