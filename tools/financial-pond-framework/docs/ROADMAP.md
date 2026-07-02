# Roadmap

This roadmap is part of the recovery contract. It records what has been built,
what is only a skeleton, and what should come next.

## v0.6.0

Scope:

- preserve project memory inside the zip
- add standalone roadmap and changelog
- add regime rule config
- add regime engine skeleton
- write regime summary into cycle output
- add news search query config
- add news search collector and tests

Non-goals:

- no trading advice engine
- no automatic portfolio allocation
- no production-grade news understanding
- no hard dependency on network data
- no core graph rewrite

## v0.7 Candidate

Recommended focus: real data connectors.

- FRED macro collector
- Binance or exchange market data collector
- WGC gold ETF data adapter
- HKEX market statistics adapter
- A-share turnover, breadth, margin, and ETF flow adapter
- source reliability config
- collector health report

## v0.8 Candidate

Recommended focus: news intelligence.

- stable news event store
- cross-source deduplication
- source credibility registry
- AI semantic classifier contract
- channel mapping by liquidity, rate, policy, earnings, regulation, geopolitics,
  risk appetite, and industry cycle
- event decay and duration logic
- market confirmation checks after events

## v0.9 Candidate

Recommended focus: historical verification.

- historical observation replay
- snapshot replay
- factor and pond score backtests
- forward return evaluation by ETF and sector ETF
- parameter comparison reports
- model version pinning for reproducibility

## v1.0 Candidate

Recommended focus: user decision workflow.

- holdings upload
- watchlists
- ETF ranking
- sector rotation report
- risk alerts
- human-readable morning and evening reports
- dashboard views by pond, sector, asset, and portfolio

