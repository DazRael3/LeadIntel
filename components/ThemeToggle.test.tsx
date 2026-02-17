// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const setThemeMock = vi.fn()
let resolvedThemeMock: string | undefined = 'dark'

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: resolvedThemeMock,
    setTheme: setThemeMock,
  }),
}))

describe('ThemeToggle', () => {
  beforeEach(() => {
    setThemeMock.mockClear()
    resolvedThemeMock = 'dark'
  })

  it('renders and toggles from dark -> light', async () => {
    const { ThemeToggle } = await import('./ThemeToggle')
    render(<ThemeToggle />)

    const btn = screen.getByRole('button', { name: /toggle color theme/i })
    fireEvent.click(btn)
    expect(setThemeMock).toHaveBeenCalledWith('light')
  })

  it('toggles from light -> dark', async () => {
    resolvedThemeMock = 'light'
    const { ThemeToggle } = await import('./ThemeToggle')
    render(<ThemeToggle />)

    await waitFor(() => expect(screen.getByText(/switch to dark mode/i)).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: /toggle color theme/i }))
    expect(setThemeMock).toHaveBeenCalledWith('dark')
  })
})

