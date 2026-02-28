import { describe, expect, it } from 'vitest'
import { computeIsPro } from './PlanProvider'

describe('computeIsPro', () => {
  it('(free, starter) -> false', () => {
    expect(computeIsPro('free', 'starter')).toBe(false)
  })

  it('(pro, starter) -> true', () => {
    expect(computeIsPro('pro', 'starter')).toBe(true)
  })

  it('(free, closer) -> true', () => {
    expect(computeIsPro('free', 'closer')).toBe(true)
  })

  it('(pro, closer) -> true', () => {
    expect(computeIsPro('pro', 'closer')).toBe(true)
  })
})

