# Module Plan

Version: v0.10.48
Status: active

Module IDs use this format:

```text
FP-AREA-Number
```

Do not use pure numeric IDs such as `FP-00`.

## Module Registry

| Module ID | Module | Role | Status | Progress | Next |
|---|---|---|---|---:|---|
| FP-CORE-01 | Core Graph Engine | Market-agnostic graph, registry, scoring, snapshots | working | 70% | Keep core free of market-specific branches |
| FP-DATA-01 | Hard Data Providers | AKShare ETF snapshot, A-share water level, provider adapters | working with fallback | 66% | Add valuation/fundamental real sources; S&P 500 provider second |
| FP-FLOW-01 | Capital Flow Engine | Convert observations into 31-slot A-share sector-flow review | working prototype | 64% | Keep provider flow `flow_ready` and expand coverage beyond representative ETFs |
| FP-GEN-01 | General Pool Analysis | Analyze pools through one component contract with pool-specific input profiles | working prototype | 52% | Surface provider-mapped vs framework-only coverage in the frontend |
| FP-GRAPH-01 | Influence Graph | Upstream, downstream, and peer influence factors | frontend prototype | 35% | Add backend edge state and confirmation history |
| FP-PV-01 | Price-Volume Analysis | Relative strength, volume, breadth, confirmation | basic | 20% | Add trend, divergence, volume expansion, and persistence |
| FP-NEWS-01 | News Pressure Engine | News as pressure, catalyst, risk, expectation | basic / fallback | 30% | Add fixed real sources and source-quality labels |
| FP-ROT-01 | Sector Rotation Intelligence | Leaders, laggards, clusters, switching paths, watch points | working prototype | 45% | Add multi-day continuation and reversal labels |
| FP-HIST-01 | Sector Rotation History | Persist daily rotation snapshots, recover recent published history, and compare latest vs previous day | working prototype | 42% | Add explicit continuation/reversal labels |
| FP-HIST-MKT-01 | Historical Market Replay | Archive normalized ETF OHLCV inputs and replay historical evidence without latest data | working prototype | 55% | Expand provider coverage and historical share-flow sources |
| FP-ETF-01 | ETF Decision Readiness | Gate whether sector rankings may support ETF action language, with share-change flow diagnostics | working prototype | 42% | Current state is `watch_only`; unblock manual valuation/fundamental seeds, rotation visibility, and execution rules |
| FP-DAILY-01 | Daily Sector Analysis | Combine flow, rotation, modules, ETF readiness, and decision tickets | working prototype | 40% | Add continuation/reversal labels after more history accumulates |
| FP-ATTR-01 | Signal Attribution | Explain daily rankings through ETF flow, rotation, modules, graph scores, and conflict notes | working prototype | 35% | Add richer attribution weights and history-aware explanations |
| FP-WATCH-01 | Watchlist State Machine | Convert attribution and daily evidence into observation states and review boundaries | working prototype | 30% | Add persistence-aware unchanged/upgraded/downgraded behavior after more daily samples |
| FP-GATE-01 | Decision Gate Ledger | Explain why provider readiness does or does not unlock execution-language readiness | working prototype | 25% | Clear valuation/fundamental, data reality, conflict-review, and execution-language blockers |
| FP-EXPLAIN-01 | Index Explainability | Explain displayed scores, ranks, readiness fields, gates, and maturity indexes with source/formula/input breakdowns | working prototype | 25% | Expand formula registry as more UI indexes become clickable |
| FP-OBS-01 | Observation Data Backbone | Preserve daily observation files, pool vectors, signal matrix rows, review logs, and pending outcomes | working prototype | 30% | Add manual review editing and realized-outcome filling |
| FP-UI-01 | Frontend Dashboard | Explain model outputs and data boundaries | usable prototype | 68% | Keep observation workbench compact and trace-visible |
| FP-RPT-01 | Reports | Daily and weekly human-readable reports | basic | 25% | Add weekly report and proposal sections |
| FP-GPT-01 | GPT Proposal Layer | Weekly keyword and graph proposals only | planned | 5% | Add proposal schema and disabled-by-default runner |
| FP-TEST-01 | Tests and Validation | Guard contracts, pipeline, Worker assets | working | 80% | Keep CI-order, history-recovery, and provider-coverage guards current |
| FP-MAINT-01 | Maintenance Protocol | Rules, update protocol, total plan, module plan | working | 75% | Keep progress updated every version |
| FP-POOL-01 | Free Pond Expansion | Add arbitrary market, asset, sector, theme, or watchlist as a pond | started | 20% | Define pond template and creation checklist |

## Progress Labels

```text
planned             designed but not implemented
basic               minimal useful function
prototype           can run or click, not complete
working prototype   usable but not decision-grade
working             stable in current package
working with fallback stable when real source fails, with visible fallback label
```

## Required Module Update Fields

When a module changes, update this table and include:

```text
Module ID:
Old status:
New status:
Progress change:
Changed files:
Boundary:
Next:
Tests:
```

## Current Priority

```text
1. FP-DATA-01: valuation/fundamental manual seed replacement.
2. FP-OBS-01: preserve every daily observation and keep history append-only.
3. FP-EXPLAIN-01: keep every displayed index backed by source/formula/input explanation.
4. FP-GATE-01: keep provider-ready-but-execution-blocked reasons visible.
5. FP-WATCH-01: keep attribution conflicts sorted into daily review states.
6. FP-GEN-01: remove pool graph snapshot dependency from one-command runs.
7. FP-HIST-01 / FP-ROT-01: improve rotation visibility while sample history is still low.
8. FP-ETF-01 / FP-DAILY-01: keep execution decision blocked until watch-only gates are cleared.
9. FP-NEWS-01: real fixed A-share news sources.
10. FP-DATA-01: S&P 500 live provider inputs after the A-share flow path is stable.
```

## v0.10.47 Status Note

```text
Provider flow: baseline_only -> flow_ready
ETF readiness: not_ready -> watch_only
Signal attribution: added observation-only conflict visibility
Watchlist state: added observation-only state machine
Decision gate ledger: added readiness explanation across provider, coverage, conflict, data reality, graph, and execution-language gates
Index explainability: added source/formula/input breakdown for displayed indexes
Remaining blockers:
- valuation/fundamental manual seed
- pool graph snapshot dependency
- rotation visibility low
- execution decision still blocked
```
