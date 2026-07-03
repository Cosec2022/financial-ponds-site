# Financial Ponds Data Status Matrix v0.10.3

Date: 2026-07-03

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
| FP-00 Site shell | real | built static assets | Cloudflare Worker | yes | no | Deploy path works through GitHub Actions and Wrangler. |
| FP-01A A-share ETF provider | real | AKShare ETF snapshot | ETF close, pct_change, amount, latest_share | yes | yes | Direct ETF flow still depends on share-change history. |
| FP-01B A-share water level | real/fallback | AKShare broad A-share data | turnover, breadth, optional margin context | yes | yes | CI can fall back to fixture if upstream disconnects. |
| FP-02 Sector flow engine | prototype | observations + provider exports | sector_flow_review.json | yes | yes | Working review layer; not a trading instruction. |
| FP-03 News search engine | real/fallback | Google News RSS or fixture | news_review.json, news_observations.json | yes | limited | News is pressure/context, not capital flow. |
| FP-04 Adaptive keyword state | planned | keyword hits + market confirmation | keyword_state updates/proposals | planned | no | Structure is designed, engine is not implemented. |
| FP-05 Pond graph | prototype/demo | pond_map.json | clickable graph UI | yes | no | Explains relationships and watchlist ponds. |
| FP-06 Adaptive graph feedback | prototype | localStorage + proposals | exported patch JSON | yes | no | Backend writeback is not implemented. |
| FP-07 Frontend dashboard UX | prototype | dashboard/flow/news/pond JSON | clickable dashboard | yes | no | Usable for inspection and explanation. |
| FP-08 Reports | prototype/planned | model outputs | daily/weekly report files | partial | no | Daily review exists; weekly review is planned. |
| FP-09 GPT review layer | planned | weekly news + hard-data history | proposal files | planned | no | GPT can propose only; hard data confirms. |
| FP-10 Tests and validation | real | source package | pass/fail checks | no | no | Root and framework tests pass in v0.10.3. |

## A-share sector coverage

The current hard-data sector flow review covers 11 A-share representative ETF pools:

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
financial-pond/data/sector_flow_review.json
financial-pond/data/news_review.json
financial-pond/data/pond_map.json
```

If a file describes schema/UI updates rather than market data, use a separate field such as:

```text
map_updated_at
schema_updated_at
```

Do not use a future market `as_of` date in packaged dashboard data.
