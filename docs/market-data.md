## Market data (Stocks + Crypto)

This app powers the **top marquee ticker**, **Markets**, and **Watchlist** views via:

- `POST /api/market/quotes`
- Client helper: `lib/market/prices.ts` → `fetchInstrumentQuotes()`

### Providers (USD)

- **Stocks (USD)**: `MARKET_DATA_PROVIDER`
  - Supported values: `finnhub` or `polygon`
  - Auth: server-side API key only (`MARKET_DATA_API_KEY`)
  - Notes:
    - Finnhub quotes (`/quote`) are USD-denominated for US equities (AAPL, MSFT, etc).
    - Polygon “prev” endpoint returns OHLC used to compute percent change.

- **Crypto (USD)**: CoinGecko (server-side, no key required for the basic endpoint we use)
  - Endpoint: `https://api.coingecko.com/api/v3/simple/price?vs_currencies=usd&include_24hr_change=true`
  - Symbols supported by default: `BTC-USD`, `ETH-USD`, `SOL-USD`, `BNB-USD`, `XRP-USD`

### Canonical quote model

The backend normalizes all providers into a single internal shape used by the UI:

- `lib/market/quotes.ts` (`MarketQuote`)
  - `lastPrice` / `changePercent` (canonical)
  - `price` / `changePct` (backwards-compatible aliases)
  - `currency: "USD"`
  - optional `source` field (`provider` / `coingecko` / `mock`)

### Debugging (dev-only)

In development only (not production), you can request debug payloads:

- `POST /api/market/quotes?debug=true`

This includes `data.debug.rawBySymbol` (best-effort upstream payloads) and `data.debug.mappedBySymbol`.

### Required environment variables

- `MARKET_DATA_PROVIDER` (recommended in production): `finnhub` or `polygon`
- `MARKET_DATA_API_KEY` (required when `MARKET_DATA_PROVIDER` is set)
- `FINNHUB_API_KEY` (optional): used only for best-effort **stock logo** lookups

