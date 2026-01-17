'use client'

import { useState, useEffect } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface StockTicker {
  symbol: string
  price: number
  change: number
  changePercent: number
}

const TICKER_STOCKS: StockTicker[] = [
  { symbol: 'AAPL', price: 178.50, change: 2.30, changePercent: 1.31 },
  { symbol: 'MSFT', price: 378.85, change: -1.20, changePercent: -0.32 },
  { symbol: 'GOOGL', price: 142.30, change: 3.45, changePercent: 2.48 },
  { symbol: 'AMZN', price: 151.20, change: 1.80, changePercent: 1.20 },
  { symbol: 'META', price: 485.60, change: -2.10, changePercent: -0.43 },
  { symbol: 'TSLA', price: 248.90, change: 5.20, changePercent: 2.14 },
  { symbol: 'NVDA', price: 875.30, change: 12.50, changePercent: 1.45 },
]

export function MarketPulseTicker() {
  const [stocks, setStocks] = useState<StockTicker[]>(TICKER_STOCKS)

  useEffect(() => {
    // Duplicate stocks for seamless scroll
    setStocks([...TICKER_STOCKS, ...TICKER_STOCKS])
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      // In production, fetch real data
      setStocks([...TICKER_STOCKS, ...TICKER_STOCKS])
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="border-b border-cyan-500/20 bg-background/90 backdrop-blur-sm overflow-hidden">
      <div className="relative">
        <div className="flex animate-scroll">
          {stocks.map((stock, index) => (
            <div
              key={`${stock.symbol}-${index}`}
              className="flex items-center gap-3 px-6 py-2 whitespace-nowrap border-r border-cyan-500/10"
            >
              <span className="font-bold bloomberg-font text-cyan-400 text-sm">
                {stock.symbol}
              </span>
              <span className="text-xs text-muted-foreground">
                ${stock.price.toFixed(2)}
              </span>
              <div className="flex items-center gap-1">
                {stock.changePercent > 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-400" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-400" />
                )}
                <span
                  className={`text-xs font-medium ${
                    stock.changePercent > 0
                      ? 'text-green-400'
                      : stock.changePercent < 0
                      ? 'text-red-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  {stock.change > 0 ? '+' : ''}
                  {stock.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
