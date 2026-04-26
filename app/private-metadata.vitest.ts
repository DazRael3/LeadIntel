import { describe, expect, it } from 'vitest'

describe('private route metadata policy', () => {
  it('dashboard and settings layouts are noindex', async () => {
    const dashboardLayout = await import('./dashboard/layout')
    const settingsLayout = await import('./settings/layout')

    expect(dashboardLayout.metadata?.robots).toMatchObject({ index: false, follow: false })
    expect(settingsLayout.metadata?.robots).toMatchObject({ index: false, follow: false })
  })

  // Metadata route imports are noticeably slower during full-suite execution due to module graph load.
  // Keep this test strict, but allow a larger per-test timeout to avoid intermittent suite-level timeouts.
  it(
    'key logged-in pages have distinct titles',
    { timeout: 30_000 },
    async () => {
      const [dash, history, pitch] = await Promise.all([
        import('./dashboard/page'),
        import('./dashboard/history/page'),
        import('./pitch-history/page'),
      ])

      expect(dash.metadata?.title).toBe('Dashboard | LeadIntel')
      expect(history.metadata?.title).toBe('Saved outputs | LeadIntel')
      expect(pitch.metadata?.title).toBe('Pitch history | LeadIntel')
    }
  )
})

