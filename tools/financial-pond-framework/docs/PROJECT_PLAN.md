# Project Plan

Version: v0.10.75
Status: active

## Final Target

Build an extensible financial pond network.

Any market, sector, asset, theme, or user-defined watchlist can be added as a pond. Each pond should be analyzed through:

```text
capital-flow signals
+ upstream / downstream / peer influence factors
+ price-volume analysis
+ news-pressure analysis
= explainable financial state
```

The network should explain:

```text
inflow / outflow
sector or asset rotation
upstream and downstream transmission
relative strength and weakness
risk pressure
data confidence and data gaps
```

The system should not output direct trading instructions.

Implementation order remains **A-share first**, then S&P 500 / U.S. markets, Hong Kong, and other global adapters after the A-share exact-date validation path is stable.

## Overall Progress

```text
Overall progress: 52%
Current stage: usable observation prototype; validation path under repair
Daily data pipeline: automated and publishing; v0.10.73 fixed historical preservation, v0.10.74 persists each verified daily Provider output before candidate/outcome processing, and v0.10.75 presents the unchanged model ranking as a Top 10 structural-observation surface
Decision-grade model: not yet
Main limitation: exact-date candidate/benchmark history is incomplete, reviewed outcomes are not yet statistically usable, and valuation/fundamental/news layers still contain manual, fallback, or unverified inputs
```

## Phase Plan

| Phase | Goal | Status | Progress |
|---|---|---|---:|
| P1 | Runnable website and basic framework | done | 100% |
| P2 | A-share sector ETF hard-data path | formed | 70% |
| P3 | Capital-flow review | formed prototype | 56% |
| P4 | Sector rotation intelligence | formed prototype | 45% |
| P5 | Multi-day trend confirmation | started | 15% |
| P6 | Price-volume analysis expansion | planned | 10% |
| P7 | Influence graph backend state | prototype | 25% |
| P8 | Real fixed news sources | planned | 10% |
| P9 | Free pond creation / arbitrary pool expansion | started | 28% |
| P10 | Full financial analysis network | working prototype | 46% |

## Current Working Surface

The site can currently show:

```text
A general pool analysis surface for S&P 500, A-share market, and A-share industries
A-share 31-industry framework review, with 11 provider-mapped representative sectors and 20 framework-only sectors
reference-first dashboard
sector rotation intelligence
sector rotation history
ETF action-readiness gate with visible blockers and pending watch items
Provider status panel showing AKShare environment, real run, flow readiness, and next command
ETF true-flow observation leaderboard with positive, negative, and zero-flow rows
Signal attribution panel explaining daily rankings and cross-module conflicts
Watchlist state panel grouping confirmed, conflict, flow-only, rotation-only, deteriorating, and avoid rows
Decision gate ledger panel explaining why provider-ready does not automatically mean execution-ready
Index explainability panel showing source files, fields, formulas, raw inputs, components, steps, caveats, and boundary for displayed indexes
Observation workbench showing today, signal matrix, vector forecasts, and pending review records
Daily data vault preserving seen files, missing files, hashes, and module availability
Published-data completeness guard for the daily Action
Daily sector analysis panel with priority watch, confirm next, and avoid watch tiers
Rotation-history recovery from recent published Git versions
clickable pond map
Top 10 structural observations in backend-published order, with no frontend re-ranking or fabricated padding
Chinese human-readable status and field-grounded explanation layer with switchable industry details
formal vector logo, pond-only favicon, and responsive mobile observation cards
news pressure with fallback labeling
local graph node edits and patch export
```

## Current Boundaries

```text
1. General pool analysis covers S&P 500 and A-share industries through one component contract with pool-specific input profiles.
2. S&P 500 live provider ingestion is not yet enabled.
3. Rotation trend confirmation still needs at least 3 trading-day samples, and v0.10.32 only recovers committed samples; it does not invent missing days.
4. News can be fallback and must be treated as degraded context.
5. Electricity is a watchlist/demo pond, not a real ETF-backed sector.
6. UI local graph edits do not change backend configuration.
7. GPT weekly review is planned only.
8. ETF readiness can block guidance even when sector rankings look strong.
9. Daily sector analysis is watch-only unless ETF readiness reaches decision-support mode; current ETF readiness is `watch_only`.
10. No output is a trading instruction.
11. ETF flow leaderboard is observation-only and must not be read as buy/sell guidance.
12. Signal attribution explains observation conflicts only; it does not unlock ETF execution advice.
13. Watchlist state is an observation workflow, not a trading instruction.
14. Decision gate ledger explains blocked readiness; it does not unlock ETF execution advice.
15. Index explainability explains displayed numbers; it does not unlock ETF execution advice.
16. The Top 10 structural-observation order is a relative evidence order, not a buy list, rise probability, or trading instruction.
```

## Next Work Order

1. Monitor the durable daily Provider-to-history path across the next scheduled run and keep its normalized daily source committed.
2. Fetch only the missing exact candidate and 510300 benchmark dates required by due T+1/T+3 reviews, then rerun outcomes fail-closed.
3. Produce the first source-backed reviewed outcomes; do not report a success rate while reviewed sample size is insufficient.
4. Propagate real provider prices/volume/amount through market signals and candidate baselines without stale-date substitution.
5. Replace valuation/fundamental manual seeds with reviewed hard-data sources.
6. Add official-source global facts, publication timestamps, event-level deduplication, and A-share transmission paths; keep media narratives display-only.
7. Keep Index Explainability, Decision Gate Ledger, Watchlist State, and Signal Attribution current while inputs mature.
8. Add continuation / reversal / strengthening / weakening labels only after uninterrupted history is sufficient.
9. Keep execution decision blocked until ETF readiness exits watch-only mode through evidence, not wording changes.
10. Add S&P 500 live inputs after the A-share exact-date outcome path is stable.
