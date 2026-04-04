// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { TriggerEventsSection } from './TriggerEventsSection'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/dashboard',
}))

vi.mock('@/components/PlanProvider', () => ({
  usePlan: () => ({
    tier: 'starter',
  }),
}))

describe('TriggerEventsSection', () => {
  it('Starter empty state shows primary continue-working CTA linking to /dashboard', () => {
    render(
      <TriggerEventsSection
        events={[]}
        loading={false}
        error={null}
        onRefresh={() => undefined}
        companyDomain={null}
        companyLabel={null}
      />
    )

    const btn = screen.getByRole('button', { name: /generate pitch draft/i })
    expect(btn).toBeTruthy()
    expect(btn.className).toContain('neon-border')
    fireEvent.click(btn)
    expect(push).toHaveBeenCalledWith('/dashboard')
  })
})

