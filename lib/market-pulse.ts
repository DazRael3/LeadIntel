/**
 * Market Pulse Functions
 * Provides market intelligence for B2B lead timing
 */

export interface MarketPulseData {
  status: 'up' | 'down' | 'neutral'
  insight: string
  averageChange: number
}

const MOCK_STOCKS = [
  { symbol: 'AAPL', changePercent: 1.31 },
  { symbol: 'MSFT', changePercent: -0.32 },
  { symbol: 'GOOGL', changePercent: 2.48 },
  { symbol: 'AMZN', changePercent: 1.20 },
  { symbol: 'META', changePercent: -0.43 },
]

/**
 * Get Market Pulse - Analyzes market conditions for lead timing
 */
export async function getMarketPulse(): Promise<MarketPulseData> {
  try {
    // Calculate average market change
    const avgChange = MOCK_STOCKS.reduce((sum, stock) => sum + stock.changePercent, 0) / MOCK_STOCKS.length
    
    // Determine status
    let status: 'up' | 'down' | 'neutral' = 'neutral'
    if (avgChange > 0.5) {
      status = 'up'
    } else if (avgChange < -0.5) {
      status = 'down'
    }

    // Generate insight based on market conditions
    let insight = 'Market stable: Steady B2B opportunities available'
    if (status === 'up') {
      insight = 'Market is up: High-growth leads are active today. Great time to reach out!'
    } else if (status === 'down') {
      insight = 'Market correction: Focus on value-driven outreach and relationship building.'
    }

    return {
      status,
      insight,
      averageChange: avgChange,
    }
  } catch (error) {
    console.error('Error getting market pulse:', error)
    return {
      status: 'neutral',
      insight: 'Market data unavailable. Proceeding with standard lead intelligence.',
      averageChange: 0,
    }
  }
}
