// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { ViewModeToggle } from './ViewModeToggle'

function Wrapper() {
  const [mode, setMode] = useState<'startup' | 'enterprise'>('startup')
  return <ViewModeToggle viewMode={mode} onViewModeChange={setMode} />
}

describe('ViewModeToggle', () => {
  it('toggles view mode and updates label', () => {
    render(<Wrapper />)
    expect(screen.getByText('Highlighting High Growth Potential')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /enterprise/i }))
    expect(screen.getByText('Highlighting Enterprise Stability')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /startup/i }))
    expect(screen.getByText('Highlighting High Growth Potential')).toBeInTheDocument()
  })
})

