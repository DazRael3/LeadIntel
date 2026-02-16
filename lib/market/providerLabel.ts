/**
 * Server-only market provider label helper.
 *
 * IMPORTANT:
 * - Do NOT import this from client components.
 * - Reads process.env, which is server-side only.
 */
export function getMarketProviderLabelFromEnv(): string | null {
  // Defensive guard: if this is somehow executed in the browser, avoid exposing env-based behavior.
  if (typeof window !== 'undefined') return null

  const id = (process.env.MARKET_DATA_PROVIDER || '').trim().toLowerCase()
  switch (id) {
    case 'finnhub':
      return 'Finnhub'
    case 'polygon':
    case 'polygonio':
    case 'polygon.io':
      return 'Polygon.io'
    default:
      return null
  }
}

