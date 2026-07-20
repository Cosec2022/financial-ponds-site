# Evening Observation Summary

## Observation State
- observe_only

## Data Readiness
- Market OHLCV mapped: 62/67; Flow mapped: 62; Fully mapped: 22; quality guardrail active
- Direct evidence 34%; proxy evidence 60%.

## What Improved Today
- Direct evidence covers 34% of observed pools.
- Proxy evidence covers 60% and carries high aggregate proxy risk.
- 62 momentum and 62 liquidity observations are available.
- 8 pools meet the strict direct-evidence strong observation gate.

## Top Observation Pools
- **通信电子** | strong_observe | inward
  - flow estimated_from_source; momentum derived_from_market; liquidity derived_from_market
  - evidence high; proxy risk none; capped confidence 0.75
  - high evidence via direct_etf; 3/3 core observations available; delta changed.
- **半导体** | strong_observe | inward
  - flow estimated_from_source; momentum derived_from_market; liquidity derived_from_market
  - evidence high; proxy risk none; capped confidence 0.75
  - high evidence via direct_etf; 3/3 core observations available; delta changed.
- **AI计算机** | strong_observe | inward
  - flow estimated_from_source; momentum derived_from_market; liquidity derived_from_market
  - evidence high; proxy risk none; capped confidence 0.75
  - high evidence via direct_etf; 3/3 core observations available; delta changed.
- **Healthcare and Pharma** | strong_observe | outward
  - flow estimated_from_source; momentum derived_from_market; liquidity derived_from_market
  - evidence high; proxy risk none; capped confidence 0.75
  - high evidence via direct_etf; 3/3 core observations available; delta changed.
- **券商** | moderate_observe | inward
  - flow estimated_from_source; momentum derived_from_market; liquidity derived_from_market
  - evidence high; proxy risk none; capped confidence 0.75
  - high evidence via direct_etf; 3/3 core observations available; delta changed.

## Caution / Low Quality Pools
- **Media**: sector_proxy with loose proxy; high proxy risk; flow unavailable
- **Environmental Protection**: sector_proxy with loose proxy; high proxy risk; flow unavailable
- **Machinery**: sector_proxy with loose proxy; high proxy risk; flow unavailable
- **Utilities**: sector_proxy with loose proxy; high proxy risk; flow unavailable
- **Agriculture**: sector_proxy with loose proxy; high proxy risk; flow unavailable

## Main Data Gaps
- flow: 45 pools; connect mapped provider flow source
- momentum: 5 pools; connect momentum confirmation
- liquidity: 5 pools; connect liquidity confirmation
- rotation: 59 pools; collect more rotation evidence
- valuation: 36 pools; connect valuation

## Boundary
- observe_only
- not investment advice
- insufficient outcome history
- no source-backed hard flow yet
