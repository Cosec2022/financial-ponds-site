# Module Plan

Version: v0.10.31
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
| FP-DATA-01 | Hard Data Providers | AKShare ETF snapshot, A-share water level, provider adapters | working with fallback | 62% | A-share provider history first; S&P 500 provider second |
| FP-FLOW-01 | Capital Flow Engine | Convert observations into 31-slot A-share sector-flow review | working prototype | 60% | Strengthen ETF share-change and market-water inputs |
| FP-GEN-01 | General Pool Analysis | Analyze pools through one component contract with pool-specific input profiles | working prototype | 52% | Surface provider-mapped vs framework-only coverage in the frontend |
| FP-GRAPH-01 | Influence Graph | Upstream, downstream, and peer influence factors | frontend prototype | 35% | Add backend edge state and confirmation history |
| FP-PV-01 | Price-Volume Analysis | Relative strength, volume, breadth, confirmation | basic | 20% | Add trend, divergence, volume expansion, and persistence |
| FP-NEWS-01 | News Pressure Engine | News as pressure, catalyst, risk, expectation | basic / fallback | 30% | Add fixed real sources and source-quality labels |
| FP-ROT-01 | Sector Rotation Intelligence | Leaders, laggards, clusters, switching paths, watch points | working prototype | 45% | Add multi-day continuation and reversal labels |
| FP-HIST-01 | Sector Rotation History | Persist daily rotation snapshots and compare latest vs previous day | working prototype | 35% | Accumulate 3+ trading days and add trend labels |
| FP-ETF-01 | ETF Decision Readiness | Gate whether sector rankings may support ETF action language | working prototype | 36% | Replace manual valuation/fundamental seeds and require observed multi-day flow |
| FP-DAILY-01 | Daily Sector Analysis | Combine flow, rotation, modules, and ETF readiness into watch tiers | working prototype | 32% | Add continuation/reversal labels after more history accumulates |
| FP-UI-01 | Frontend Dashboard | Explain model outputs and data boundaries | usable prototype | 65% | Add maintenance-state display |
| FP-RPT-01 | Reports | Daily and weekly human-readable reports | basic | 25% | Add weekly report and proposal sections |
| FP-GPT-01 | GPT Proposal Layer | Weekly keyword and graph proposals only | planned | 5% | Add proposal schema and disabled-by-default runner |
| FP-TEST-01 | Tests and Validation | Guard contracts, pipeline, Worker assets | working | 79% | Keep CI-order and provider-coverage guards current |
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
1. FP-DATA-01: A-share hard-data depth first.
2. FP-HIST-01: accumulate at least 3 trading days.
3. FP-NEWS-01: real fixed A-share news sources.
4. FP-DAILY-01: improve continuation/reversal labels without weakening ETF gates.
5. FP-GEN-01: sync reusable coverage/confidence work into the shared model.
6. FP-DATA-01: S&P 500 live provider inputs after the A-share baseline is firmer.
```
