# Project Plan

Version: v0.10.47
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

## Overall Progress

```text
Overall progress: 45%
Current stage: usable prototype
Daily data pipeline: partial, with AKShare provider flow_ready, one-command recovery for missing pool graph snapshots, signal attribution, watchlist state machine, decision gate ledger, and index explainability
Decision-grade model: not yet
Main limitation: A-share provider flow is flow_ready and displayed numbers are now explainable, but ETF readiness remains watch_only/not_ready when source, valuation/fundamental, rotation, conflict-review, data reality, or execution gates block guidance
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
| P10 | Full financial analysis network | working prototype | 45% |

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
Published-data completeness guard for the daily Action
Daily sector analysis panel with priority watch, confirm next, and avoid watch tiers
Rotation-history recovery from recent published Git versions
clickable pond map
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
```

## Next Work Order

1. A-share first: replace valuation/fundamental manual seeds with reviewed hard-data sources.
2. Use Index Explainability to keep every displayed score/rank/readiness number traceable.
3. Use Decision Gate Ledger to keep provider-ready-but-execution-blocked reasons visible.
4. Use Watchlist State to route conflict, flow-only, and rotation-only rows before changing scoring.
5. Use Signal Attribution to review ETF-flow-vs-daily-leader conflicts before changing scoring.
6. Make pool graph snapshots robust so `pool:analysis` can run after cycle recovery or graceful fallback.
7. Improve rotation visibility while sample history is still low.
8. Keep execution decision blocked until ETF readiness exits watch-only mode.
9. Sync shared work into the general model: input coverage, confidence labels, missing-input reporting, and component contract tests.
10. S&P 500 second: add live provider inputs for flow, breadth, EPS/valuation, and news pressure after the A-share flow path is stable.
11. Add continuation / reversal / strengthening / weakening labels.
12. Feed confirmed trend labels into the daily sector analysis scoring.
13. Implement keyword state engine.
14. Implement graph edge state backend.
