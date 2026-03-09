export function isLikelyTouchDevice(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as Navigator & { maxTouchPoints?: number }
  const points = typeof nav.maxTouchPoints === 'number' ? nav.maxTouchPoints : 0
  return points > 0
}

