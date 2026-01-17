'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Activity, Sparkles } from "lucide-react"
import { useState, useEffect, useCallback } from "react"

interface StockData {
  symbol: string
  name: string
  price: number
  change: number
  changePercent: number
  insight?: string
}

// Mock data - Replace with Alpha Vantage API in production
const MOCK_STOCKS: StockData[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 178.50, change: 2.30, changePercent: 1.31 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', price: 378.85, change: -1.20, changePercent: -0.32 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 142.30, change: 3.45, changePercent: 2.48 },
  { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 151.20, change: 1.80, changePercent: 1.20 },
  { symbol: 'META', name: 'Meta Platforms', price: 485.60, change: -2.10, changePercent: -0.43 },
]

export function MarketPulse() {
  const [stocks, setStocks] = useState<StockData[]>([])
  const [loading, setLoading] = useState(true)

  const loadMarketData = useCallback(async () => {
    try {
      // In production, use Alpha Vantage API:
      // const response = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${API_KEY}`)
      
      // For now, use mock data with AI insights
      const stocksWithInsights = await Promise.all(
        MOCK_STOCKS.map(async (stock) => {
          const insight = await generateSalesInsight(stock)
          return { ...stock, insight }
        })
      )
      
      setStocks(stocksWithInsights)
    } catch (error) {
      console.error('Error loading market data:', error)
      // Fallback to mock data without insights
      setStocks(MOCK_STOCKS)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMarketData()
    // Refresh every 30 seconds
    const interval = setInterval(loadMarketData, 30000)
    return () => clearInterval(interval)
  }, [loadMarketData])

  const generateSalesInsight = async (stock: StockData): Promise<string> => {
    // In production, use OpenAI API for insights
    // For now, return contextual insights based on market movement
    if (stock.changePercent > 1.5) {
      return 'Market surge: High-growth leads are actively seeking solutions'
    } else if (stock.changePercent > 0.5) {
      return 'Market is up: High-growth leads are active today'
    } else if (stock.changePercent < -0.5) {
      return 'Market correction: Focus on value-driven outreach'
    } else {
      return 'Market stable: Steady B2B opportunities available'
    }
  }

  return (
    <Card className="border-cyan-500/20 bg-card/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-cyan-400" />
            <CardTitle className="text-lg bloomberg-font">MARKET PULSE</CardTitle>
          </div>
          <Badge variant="outline" className="border-cyan-500/30 text-cyan-400 bg-cyan-500/10">
            LIVE
          </Badge>
        </div>
        <CardDescription className="text-xs uppercase tracking-wider">
          Top 5 Tech Stocks • 24h Change
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-muted/20 animate-pulse rounded" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {stocks.map((stock) => (
              <div
                key={stock.symbol}
                className="flex items-center justify-between p-3 rounded-lg border border-cyan-500/10 bg-background/30 hover:bg-background/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold bloomberg-font text-cyan-400">{stock.symbol}</span>
                    <span className="text-sm text-muted-foreground">{stock.name}</span>
                    {stock.changePercent > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-400" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      ${stock.price.toFixed(2)}
                    </span>
                    <span
                      className={
                        stock.changePercent > 0
                          ? 'text-green-400'
                          : stock.changePercent < 0
                          ? 'text-red-400'
                          : 'text-muted-foreground'
                      }
                    >
                      {stock.change > 0 ? '+' : ''}
                      {stock.change.toFixed(2)} ({stock.changePercent > 0 ? '+' : ''}
                      {stock.changePercent.toFixed(2)}%)
                    </span>
                  </div>
                  {stock.insight && (
                    <div className="flex items-start gap-2 mt-2 pt-2 border-t border-cyan-500/10">
                      <Sparkles className="h-3 w-3 text-purple-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground italic">{stock.insight}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
