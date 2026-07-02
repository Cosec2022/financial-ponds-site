# Data Source Strategy

This project separates hard data from news.

```text
Hard data = financial players have already voted with money.
News = expectations about future liquidity, cash flow, risk, policy, or regulation.
Market confirmation = whether price, volume, breadth, and flow confirm the expectation.
```

## News Source Layers

### 1. Official Sources

Highest credibility. Use for policy, filings, releases, and official statistics.

Examples:

- Federal Reserve / FOMC
- US Treasury
- SEC / EDGAR
- PBOC
- Ministry of Finance
- CSRC
- Shanghai/Shenzhen exchanges
- HKEXnews
- World Gold Council

Recommended source type:

```json
{
  "source_type": "official",
  "credibility": 0.95
}
```

### 2. Major Financial Media

Use for market narrative and fast reporting.

Examples:

- Reuters
- Bloomberg
- WSJ
- FT
- CNBC
- MarketWatch
- Nikkei
- major China financial media

These require deduplication. Ten articles about the same event must not create ten separate signal boosts.

### 3. Sector Sources

Use for industry ETF analysis.

Examples:

- semiconductors: SEMI, TrendForce, company filings, TSMC monthly revenue
- AI: OpenAI, Microsoft, Nvidia, Meta, Google, Amazon earnings and blogs
- gold: World Gold Council
- crypto: ETF issuers, exchanges, on-chain data providers

### 4. Sentiment Sources

Low credibility by default.

Examples:

- X/Twitter
- Reddit
- Xueqiu
- Eastmoney forums
- Telegram
- YouTube

These can be useful as crowding or sentiment indicators, but they should not be treated as facts.

## Hard Data Sources

Hard data should be collected through APIs, CSV downloads, exchange statistics, or stable vendor endpoints.

First batch candidates:

- FRED: real rates, yields, spreads, M2, unemployment, inflation expectations
- SEC/EDGAR: filings and disclosure events
- Binance: public crypto market data
- World Gold Council: gold ETF holdings and flows
- HKEX: trading value, volume, short selling, market statistics
- A-share sources: exchange pages, PBOC, CSRC, AkShare/TuShare or paid vendors

## Collector Rule

Collectors only emit observations.

They do not:

- calculate final pool scores
- change graph edges
- decide allocation
- write UI state

## Source Quality

Every source should eventually have:

- source type
- credibility score
- update frequency
- latency expectation
- data license note
- failure mode
- fallback source
