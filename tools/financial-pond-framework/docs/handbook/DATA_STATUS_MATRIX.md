# Financial Ponds Data Status Matrix v0.10.9

Date: 2026-07-05

This file separates real inputs, fallback inputs, demo UI data, and planned modules. Future edits should update this matrix when a module changes state.

## Status labels

```text
real        Actual provider or model output can run in the daily pipeline.
fallback    Deterministic fallback exists for CI continuity. It is not live market data.
demo        Displayed in the frontend to explain model shape. It is not used as hard evidence.
prototype   Implemented enough to click/test, but not yet a full backend state machine.
planned     Designed but not implemented.
```

## Current data and module state

| Module | Status | Input | Output | Used By Frontend | Used By Scoring | Notes |
|---|---|---|---|---|---|---|
| FP-CORE-01 Core graph engine | real | config + observations | graph scores and snapshots | indirect | yes | Core must stay market-agnostic. |
| FP-DATA-01 Hard data providers | real/fallback | AKShare ETF snapshot + A-share water level | ETF close, pct_change, amount, latest_share, turnover, breadth | yes | yes | Direct ETF flow still depends on share-change history. |
| FP-FLOW-01 Capital flow engine | prototype | observations + provider exports | sector_flow_review.json | yes | yes | Working review layer; not a trading instruction. |
| FP-GEN-01 General pool analysis | prototype | graph_scores.json + pool_internal_models.json + general_pool_input_contract.json | general_pool_analysis.json | yes | no | Shared component contract with pool-specific input profiles for S&P 500, A-share market, and A-share industries. |
| FP-GRAPH-01 Influence graph | prototype/demo | pond_map.json | clickable graph UI | yes | no | Explains upstream, downstream, and peer relationships. |
| FP-PV-01 Price-volume analysis | basic | price, amount, relative strength, breadth proxies | confirmation components | yes | yes | Needs trend, divergence, and persistence. |
| FP-NEWS-01 News pressure engine | real/fallback | Google News RSS or fixture | news_review.json, news_observations.json | yes | limited | News is pressure/context, not capital flow. |
| FP-ROT-01 Sector rotation intelligence | prototype | sector_flow_review.json + news_review.json | sector_rotation_intelligence.json | yes | no | Single-day rotation explanation only. |
| FP-HIST-01 Sector rotation history | prototype | sector_rotation_intelligence.json + previous history | sector_rotation_history.json | yes | no | Stores snapshots; trend needs enough samples. |
| FP-UI-01 Frontend dashboard | prototype | dashboard/flow/rotation/news/pond JSON | clickable dashboard | yes | no | Usable for inspection and explanation. |
| FP-RPT-01 Reports | prototype/planned | model outputs | daily/weekly report files | partial | no | Daily review exists; weekly review is planned. |
| FP-GPT-01 GPT proposal layer | planned | weekly news + hard-data history | proposal files | planned | no | GPT can propose only; hard data confirms. |
| FP-TEST-01 Tests and validation | real | source package | pass/fail checks | no | no | Root and framework tests guard current behavior. |
| FP-MAINT-01 Maintenance protocol | real | rules + plans + changelog | recovery and update discipline | no | no | v0.10.6 maintenance convergence. |
| FP-POOL-01 Free pond expansion | planned | pond templates + config | arbitrary new ponds | planned | planned | Future free expansion workflow. |

## A-share sector coverage

The current A-share sector flow review has 31 framework slots.

```text
provider_mapped_representative: 11
framework_only: 20
```

Provider-mapped representative ETF pools:

```text
brokerage
bank_insurance
semiconductor
ai_computer
communication_electronics
new_energy_ev
healthcare_pharma
consumer
defense_military
resources_materials
real_estate_infra
```

The remaining framework-only slots have pool, node, asset, and edge structure but do not yet have reviewed ETF-flow provider mappings.

## Watchlist/demo ponds

```text
electric_power
```

`electric_power` is intentionally visible because it demonstrates adaptive upstream/downstream graph logic. It is not yet a real ETF-backed sector in this package.

Required work before treating it as real:

```text
1. Add pool config.
2. Add representative ETF or index data source.
3. Add node configs.
4. Add provider-to-observation mapping.
5. Add tests.
6. Show it in sector_flow_review.json through the normal flow engine.
```

## Runtime output boundary

The package may include sample runtime folders:

```text
observations/
snapshots/
model_outputs/
reports/
```

These are examples of generated state. They should not be edited as source configuration. If future packages need deterministic samples, prefer moving them into:

```text
examples/fixtures/
```

## Date consistency rule

Published frontend JSON should use a consistent market `as_of` date:

```text
financial-pond/data/dashboard.json
financial-pond/data/general_pool_analysis.json
financial-pond/data/sector_flow_review.json
financial-pond/data/sector_rotation_intelligence.json
financial-pond/data/sector_rotation_history.json
financial-pond/data/news_review.json
financial-pond/data/pond_map.json
```

If a file describes schema/UI updates rather than market data, use a separate field such as:

```text
map_updated_at
schema_updated_at
```

Do not use a future market `as_of` date in packaged dashboard data.
