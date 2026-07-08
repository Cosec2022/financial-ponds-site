# Project Plan

Version: v0.10.42
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
Daily data pipeline: partial, with CI ordering fixed and recent Git history recovery for 31-industry A-share review
Decision-grade model: not yet
Main limitation: A-share now has an ETF action-readiness gate and daily sector analysis, but still needs stronger hard-data history, observed ETF share-change flow, real valuation/fundamental sources, real news quality, and multi-day confirmation before it can guide allocation
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
9. Daily sector analysis is watch-only unless ETF readiness reaches decision-support mode.
10. No output is a trading instruction.
```

## Next Work Order

1. A-share first: strengthen ETF share-change history, A-share water-level inputs, real news quality, and multi-day rotation confirmation.
2. Sync shared work into the general model: input coverage, confidence labels, missing-input reporting, and component contract tests.
3. S&P 500 second: add live provider inputs for flow, breadth, EPS/valuation, and news pressure after the A-share baseline is firmer.
4. Add continuation / reversal / strengthening / weakening labels.
5. Feed confirmed trend labels into the daily sector analysis scoring.
6. Implement keyword state engine.
7. Implement graph edge state backend.
