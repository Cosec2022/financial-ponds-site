# Project Memory

This document is a recovery file. It records the project intent, design rules,
and open work so a future assistant or human engineer can continue from the zip
without relying on chat history.

## User Goal

The user wants a configurable investment research platform that models global
capital as connected financial ponds. The first decision target is ETF and
sector ETF direction, not single-stock guessing.

Initial ponds:

- US equity
- A-share
- BTC
- gold

Planned extensions:

- Hong Kong equity
- A-share sector ponds
- US sector ponds
- BTC-related child ponds
- gold miner and precious-metal child ponds
- user holdings and watchlists

The system should collect hard data and news twice per day, convert them into
standard observations, run the graph model, and produce a human-readable report
plus web dashboard data.

## Non-Negotiable Design Rules

- Core engine code must remain market-agnostic.
- Financial assumptions belong in config files and docs.
- Every pond has its own closed internal model.
- Nodes are the external interface between collectors and ponds.
- News must become observations; news must not directly set final pond scores.
- AI analysis may classify, summarize, and explain. It must not mutate core
  scoring state.
- Frontend code must read exported data only. It must not calculate financial
  logic.
- New ponds, nodes, assets, portfolios, and sources should be added through
  config and small adapters, not by changing the core graph engine.
- Recovery docs must stay in the zip so version loss does not block future work.

## Pond Internal Model

Each pond should be readable as:

```text
external nodes -> internal components -> final pond score -> explanation -> downstream output
```

Shared internal components:

- upstream score
- inflow score
- retention score
- downstream diffusion score
- news expectation score
- market confirmation score
- regime adjustment

These components are interpretation layers. The graph still moves values through
configured edges.

## Data Philosophy

Hard data means market participants have already acted with capital or risk.
Examples:

- ETF flow
- turnover
- breadth
- margin financing
- rates and real rates
- credit spreads
- DXY
- exchange statistics
- stablecoin supply
- on-chain flow

News means future expectations may have changed. Examples:

- central bank policy
- fiscal policy
- regulation
- corporate filings
- geopolitical risk
- industry supply and demand
- AI or semiconductor capex

The intended model split:

```text
final pond view =
  hard data score
  + news expectation score
  + market confirmation score
  + regime context
```

News is an early-warning and explanation layer. Market confirmation decides
whether the news is being accepted by price, volume, flow, and breadth.

## News Pipeline Target

The news system should evolve through these steps:

```text
collect -> deduplicate -> classify -> channel map -> score -> observation -> confirmation
```

Current v0.6 state:

- RSS collector exists.
- News search collector exists.
- Search queries are configured but disabled by default.
- Rule matching is keyword-based.
- AI semantic classification is not implemented yet.
- Deduplication exists only inside the news search collector.

## ETF Model Memory

The first practical decision target after v0.6 is:

- A-share industry ETFs
- S&P 500 ETFs

The ETF model has been documented in `docs/ETF_FLOW_MODEL.md`.

v0.10.25 adds `FP-ETF-01` ETF Decision Readiness. It is a gatekeeper between
sector rankings and ETF action language. It must block buy-oriented labels when
AKShare data is only `baseline_only`, sector-flow sources are mock/fixture, real
ETF-flow coverage is too low, rotation history has fewer than 3 samples, or
valuation/fundamental inputs are still manual seeds. It is not an allocation
engine and must not create buy/sell orders.

Important implementation rule:

- add A-share industry ETF definitions through
  `config/sector_catalog/a_share_industry_etfs.json`
- run `npm run materialize:sectors` after editing the sector catalog
- do not add ETF-specific logic to `src/core`
- keep report display entities in `config/reporting/default_entities.json`
- keep collectors separate from model scoring

## Open-Source Provider Decision

The user asked whether A-share ETF data can be sourced from open-source GitHub
projects instead of manual copying. The v0.7.1 comparison is recorded in:

- `docs/OPEN_SOURCE_DATA_PROVIDER_COMPARISON.md`
- `config/data_providers/open_source_candidates.json`

Current provider order:

1. `akshare`: primary A-share ETF data candidate.
2. `efinance`: quote-history and amount fallback.
3. `tushare`: optional structured source when a token is available.
4. `mootdx`: low-priority Tongdaxin quote fallback.
5. `qlib`: future research/backtest reference, not the first ingestion source.

Critical boundary:

- provider packages stay outside `src/core`
- provider bridges export local CSV or JSON
- existing collectors convert exports into observations
- providers never directly set final pond scores

Next concrete engineering step:

```text
providers/akshare_etf_bridge
-> raw_data/provider/akshare/<date>/
-> data/provider_exports/a_share_etf_daily.csv
-> local_csv_collector
-> node observations
```

v0.7.2 adds this bridge in fixture-capable form. The real AKShare path exists
but is not part of the scheduled pipeline yet. Before enabling any provider
export source, review:

- `providers/akshare_etf_bridge/provider_contract.json`
- `docs/AKSHARE_ETF_BRIDGE.md`
- `data/provider_exports/a_share_etf_daily.csv`
- `data/provider_exports/a_share_sector_flow.csv`

v0.7.3 adds export validation and disabled local CSV templates for all 11
A-share sector ETF-flow columns. Real AKShare export was not run in the build
environment because AKShare was not installed and package installation was not
available. Use:

```bash
npm run provider:akshare:fixture
npm run provider:akshare:validate
```

After installing AKShare locally, use:

```bash
npm run provider:akshare
npm run provider:akshare:validate
```

The user's first real run on macOS with AKShare 1.18.64 failed because
`fund_etf_scale_sse` did not accept the `symbol` keyword. v0.7.4 fixes this
inside the provider bridge. If a future run fails, check:

```text
model_outputs/provider_runs/akshare_etf_bridge_<date>.json
model_outputs/provider_validation/akshare_etf_bridge_validation.json
```

The user's next v0.7.4 run failed because `compact_date` had been removed while
the call site still used it. v0.7.5 restores the helper and adds a fake-AKShare
real-path test.

The user's next v0.7.5 run reached AKShare but failed on the optional Shenzhen
scale endpoint with an SSL EOF error from `fund.szse.cn`. v0.7.6 makes SSE/SZSE
share-scale endpoints optional enrichment sources. Spot quote export can
continue, while validation still protects the model from treating incomplete
flow data as complete.

Future target:

- event store with stable event IDs
- source reliability registry
- duplicate event clustering across sources
- AI classifier that emits the same observation contract
- market confirmation loop
- backtest of news impact against later price and flow data

## Model Theory Anchors

The framework should repeatedly compare its assumptions with established market
and macro theory:

- asset pricing: expected cash flow, discount rate, and risk premium
- liquidity and credit cycle models
- monetary transmission and real-rate impact
- portfolio flow and market microstructure
- behavioral finance and narrative-driven expectation shifts
- risk-on/risk-off regime models
- global dollar liquidity and cross-border capital flow

The code should not claim these theories are fully implemented. It should make
the current approximation visible.

## Current v0.6 Focus

This version adds three recovery-critical capabilities:

- project memory and roadmap inside docs
- a regime engine skeleton
- a news search collector with query config

The regime engine is intentionally read-only for now. It summarizes context and
does not alter graph scores.

## Future Work

- v0.7.7 confirmed that the user's real AKShare run can succeed on macOS, then
  repacked the project without build-time runtime outputs. This prevents
  stale sample outputs from confusing future validation.
- v0.7.8 added a read-only AKShare export inspector.
- v0.7.9 separated first-run ETF baseline validity from actual ETF-flow
  readiness.
- v0.8.0 added Provider Lab for efinance and qstock probes plus three-provider
  A-share ETF comparison.
- v0.9.0 adds the first executable Flow Engine for A-share sector ETF review.
- v0.9.1 adds an AKShare export to Flow Engine observation bridge.

## v0.9.0 Flow Engine Memory

The user corrected the model direction: the framework should not build overly
precise event chains such as:

```text
one overseas stock move -> one A-share ETF
```

The correct design is:

```text
external event -> wide risk factor -> sector pressure review -> domestic market confirmation
```

Wide factors are configured in:

```text
config/model/flexible_risk_factors.json
```

The Flow Engine is configured in:

```text
config/model/flow_engine_v0_9.json
```

The Flow Engine reads observations and scenario factors, then writes:

```text
model_outputs/<date>/sector_flow_review.json
model_outputs/<date>/sector_flow_review.md
```

It does not change graph scores, source enable flags, or portfolio actions.

Primary commands:

```bash
npm run flow:review:fixture
npm run flow:review -- --as-of 2026-07-03
```

Read `docs/FLOW_ENGINE_V0_9.md` before changing this layer.

## v0.9.1 AKShare Input Memory

The user's real AKShare run produced:

```text
close: available
pct_change: available
amount: available
latest_share: available
estimated_flow: missing on first baseline date
```

The model must not block all review work just because `estimated_flow` is
missing, but it also must not fabricate ETF flow.

The bridge therefore uses:

```text
pct_change -> relative_strength proxy
amount rank -> leader_confirmation proxy
estimated_flow -> etf_flow only when available
```

Command:

```bash
npm run provider:akshare:to-flow
```

Read `docs/FLOW_ENGINE_V0_9_1_AKSHARE_INPUTS.md` before changing this mapping.

## v0.9.2 macOS Test Memory

The user's macOS run showed the real model commands working:

```text
npm run provider:akshare:to-flow
npm run flow:review -- --as-of 2026-07-02
```

The same run still had one `npm test` failure in a temporary-directory Flow
Engine test. That failure was a test harness issue, not a model pipeline issue.

The fix changed the test to call `runSectorFlowReview` directly with an isolated
temporary root directory. The test still proves that the review writes isolated
outputs and does not change source status.

## v0.9.3 Provider Quality Memory

The user's provider-lab run showed a critical distinction:

```text
efinance can produce 11 representative rows, but all quote fields may be null.
qstock may install but fail at import time because of native py-mini-racer
symbol errors on macOS.
```

Provider comparison must therefore never use row count alone as confidence
evidence.

Rules added in v0.9.3:

```text
usable quote provider = at least one usable close, amount, or pct_change field
cross-checked quote row = at least two usable quote providers for the same ETF
empty efinance rows = no_usable_fields, not backup confirmation
qstock native import failure = dependency_error
```

Until another provider returns usable quote fields, AKShare remains the only
real quote provider for A-share industry ETF review.

## v0.9.4 efinance Probe Memory

The user's v0.9.3 run stopped after repeated efinance messages such as:

```text
证券代码 "sh512000" 可能有误
证券代码 "SH512000" 可能有误
```

This came from the efinance probe trying ETF codes with sh/sz prefixes.

Rule after v0.9.4:

```text
Do not brute-force market prefixes in the default efinance real probe.
Probe the canonical six-digit ETF code only.
If no usable quote fields appear, mark efinance as no_usable_fields.
```

The `npm test` suite must not depend on real efinance network behavior or local
efinance package state.

## Remaining Work

- Add real FRED collector for rates, liquidity, and macro series.
- Add Binance or exchange collector for BTC price, volume, and market data.
- Add WGC or equivalent gold ETF flow source.
- Add HKEX market statistics adapter.
- Add A-share data adapter for turnover, margin, ETF flow, and breadth.
- Add Hong Kong equity pond through config.
- Add sector ETF universe config and upload path.
- Add portfolio upload and attribution module.
- Add source-quality metadata for every collector.
- Add historical replay and backtest module.
- Add market confirmation metrics for every news event.
- Add AI semantic classifier behind the existing analyzer contract.
- Improve dashboard layout after model outputs stabilize.
