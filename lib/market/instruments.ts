export type InstrumentKind = 'stock' | 'crypto'

export interface InstrumentDefinition {
  /** e.g. 'AAPL' or 'BTC-USD' */
  symbol: string
  /** e.g. 'Apple' or 'Bitcoin' */
  name: string
  kind: InstrumentKind
  defaultVisible: boolean
  /** Default ordering for ticker/sidebar. Lower comes first. */
  order: number
}

// Curated default set (roughly top large-cap US stocks + top crypto pairs).
// Note: Symbols are kept provider-agnostic; crypto uses "-USD" pairs.
export const DEFAULT_INSTRUMENTS: InstrumentDefinition[] = [
  { symbol: 'AAPL', name: 'Apple', kind: 'stock', defaultVisible: true, order: 1 },
  { symbol: 'MSFT', name: 'Microsoft', kind: 'stock', defaultVisible: true, order: 2 },
  { symbol: 'GOOGL', name: 'Alphabet', kind: 'stock', defaultVisible: true, order: 3 },
  { symbol: 'AMZN', name: 'Amazon', kind: 'stock', defaultVisible: true, order: 4 },
  { symbol: 'META', name: 'Meta', kind: 'stock', defaultVisible: true, order: 5 },
  { symbol: 'NVDA', name: 'NVIDIA', kind: 'stock', defaultVisible: true, order: 6 },
  { symbol: 'TSLA', name: 'Tesla', kind: 'stock', defaultVisible: true, order: 7 },
  { symbol: 'NFLX', name: 'Netflix', kind: 'stock', defaultVisible: true, order: 8 },
  { symbol: 'AMD', name: 'AMD', kind: 'stock', defaultVisible: true, order: 9 },
  { symbol: 'AVGO', name: 'Broadcom', kind: 'stock', defaultVisible: true, order: 10 },
  { symbol: 'BRK.B', name: 'Berkshire', kind: 'stock', defaultVisible: true, order: 11 },
  { symbol: 'JPM', name: 'JPMorgan', kind: 'stock', defaultVisible: true, order: 12 },
  { symbol: 'V', name: 'Visa', kind: 'stock', defaultVisible: true, order: 13 },
  { symbol: 'MA', name: 'Mastercard', kind: 'stock', defaultVisible: true, order: 14 },
  { symbol: 'COST', name: 'Costco', kind: 'stock', defaultVisible: true, order: 15 },
  { symbol: 'LLY', name: 'Eli Lilly', kind: 'stock', defaultVisible: true, order: 16 },
  { symbol: 'XOM', name: 'Exxon Mobil', kind: 'stock', defaultVisible: true, order: 17 },
  { symbol: 'JNJ', name: 'Johnson & Johnson', kind: 'stock', defaultVisible: true, order: 18 },
  { symbol: 'UNH', name: 'UnitedHealth', kind: 'stock', defaultVisible: true, order: 19 },
  { symbol: 'WMT', name: 'Walmart', kind: 'stock', defaultVisible: true, order: 20 },

  // Crypto (USD pairs)
  { symbol: 'BTC-USD', name: 'Bitcoin', kind: 'crypto', defaultVisible: true, order: 101 },
  { symbol: 'ETH-USD', name: 'Ethereum', kind: 'crypto', defaultVisible: true, order: 102 },
  { symbol: 'SOL-USD', name: 'Solana', kind: 'crypto', defaultVisible: true, order: 103 },
  { symbol: 'BNB-USD', name: 'BNB', kind: 'crypto', defaultVisible: true, order: 104 },
  { symbol: 'XRP-USD', name: 'XRP', kind: 'crypto', defaultVisible: true, order: 105 },
]

export function getDefaultVisibleInstruments(): InstrumentDefinition[] {
  return DEFAULT_INSTRUMENTS.filter((i) => i.defaultVisible).slice().sort((a, b) => a.order - b.order)
}

export function findDefaultInstrument(symbol: string, kind: InstrumentKind): InstrumentDefinition | undefined {
  const normalizedSymbol = symbol.trim().toUpperCase()
  return DEFAULT_INSTRUMENTS.find((i) => i.kind === kind && i.symbol.toUpperCase() === normalizedSymbol)
}

