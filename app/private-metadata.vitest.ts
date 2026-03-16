import { describe, expect, it } from 'vitest'

describe('private route metadata policy', () => {
  it('dashboard and settings layouts are noindex', async () => {
    const dashboardLayout = await import('./dashboard/layout')
    const settingsLayout = await import('./settings/layout')

    expect(dashboardLayout.metadata?.robots).toMatchObject({ index: false, follow: false })
    expect(settingsLayout.metadata?.robots).toMatchObject({ index: false, follow: false })
  })

  it('key logged-in pages have distinct titles', async () => {
    const dash = await import('./dashboard/page')
    const history = await import('./dashboard/history/page')
    const pitch = await import('./pitch-history/page')

    expect(dash.metadata?.title).toBe('Dashboard | LeadIntel')
    expect(history.metadata?.title).toBe('Saved outputs | LeadIntel')
    expect(pitch.metadata?.title).toBe('Pitch history | LeadIntel')
  })
})

