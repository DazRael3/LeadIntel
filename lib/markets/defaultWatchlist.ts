export type InstrumentType = 'stock' | 'crypto'

export interface DefaultInstrument {
  symbol: string
  type: InstrumentType
  label?: string
}

export const DEFAULT_STOCKS: DefaultInstrument[] = [
  { symbol: 'AAPL', type: 'stock', label: 'Apple' },
  { symbol: 'MSFT', type: 'stock', label: 'Microsoft' },
  { symbol: 'GOOGL', type: 'stock', label: 'Alphabet' },
  { symbol: 'AMZN', type: 'stock', label: 'Amazon' },
  { symbol: 'META', type: 'stock', label: 'Meta' },
  { symbol: 'NVDA', type: 'stock', label: 'NVIDIA' },
  { symbol: 'TSLA', type: 'stock', label: 'Tesla' },
  { symbol: 'AMD', type: 'stock', label: 'AMD' },
  { symbol: 'NFLX', type: 'stock', label: 'Netflix' },
  { symbol: 'AVGO', type: 'stock', label: 'Broadcom' },
  { symbol: 'JPM', type: 'stock', label: 'JPMorgan' },
  { symbol: 'BAC', type: 'stock', label: 'Bank of America' },
  { symbol: 'V', type: 'stock', label: 'Visa' },
  { symbol: 'MA', type: 'stock', label: 'Mastercard' },
  // Many data providers represent Berkshire as BRK.B (keep the dot).
  { symbol: 'BRK.B', type: 'stock', label: 'Berkshire' },
  { symbol: 'XOM', type: 'stock', label: 'Exxon Mobil' },
  { symbol: 'JNJ', type: 'stock', label: 'Johnson & Johnson' },
  { symbol: 'UNH', type: 'stock', label: 'UnitedHealth' },
  { symbol: 'PEP', type: 'stock', label: 'PepsiCo' },
  { symbol: 'KO', type: 'stock', label: 'Coca-Cola' },
]

export const DEFAULT_CRYPTOS: DefaultInstrument[] = [
  { symbol: 'BTC', type: 'crypto', label: 'Bitcoin' },
  { symbol: 'ETH', type: 'crypto', label: 'Ethereum' },
  { symbol: 'SOL', type: 'crypto', label: 'Solana' },
  { symbol: 'BNB', type: 'crypto', label: 'BNB' },
  { symbol: 'XRP', type: 'crypto', label: 'XRP' },
]

export const DEFAULT_WATCHLIST: DefaultInstrument[] = [...DEFAULT_STOCKS, ...DEFAULT_CRYPTOS]

