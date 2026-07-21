# Project State

This file is the first recovery checkpoint for anyone resuming the project from
a zip package, especially when conversation history is missing.

## Current Version

Package version: `0.10.73`

Purpose of this version:

- fix FP-HIST-MKT-01 cumulative ETF market-input persistence so the archive step no longer rewrites the provider CSV from a fixed pre-2026-07-11 Git baseline
- preserve all existing normalized ETF rows with `date <= AS_OF`, then upsert exact-date historical bars
- keep historical replay no-lookahead by excluding rows later than `AS_OF`
- prevent a failed historical endpoint from deleting the live provider snapshot already collected for the current session
- add regression coverage for cumulative preservation, same-date upsert, and future-row exclusion
- synchronize the operational plan with v0.10.72/v0.10.73 reality: engineering automation is usable, but decision-grade validation remains blocked by incomplete exact-date review inputs and non-real model layers
- keep all outputs observe-only; this release does not add trading instructions, fabricate review prices, or unlock ETF execution language

Historical note: the detailed v0.10.48 capability list below is retained as implementation history.

- add the Observation Data Backbone and Workbench UI layer
- add `src/core/observation_schema.mjs` with generic universe, pool, signal, vector, review, outcome, and boundary contracts
- add `npm run data:vault` to preserve the complete daily observation file surface, including seen files, missing files, hashes, available modules, missing modules, and data-reality summary
- add `npm run observation:snapshot` to write generic pool-level vector observations with all signal slots always present
- append one observation-history record per pool per run without overwriting previous rows
- publish `observation_snapshot.json`, `manual_review_log.json`, `outcome_labels.json`, and `daily_data_vault.json`
- add pending T+1, T+3, T+5, and T+20 outcome checks for every observation
- add a homepage "观察工作台" with 今日观察, 信号矩阵, 资金矢量, and 复盘记录 tabs
- keep the core schema market-agnostic; A-share remains the first sample universe, not the model assumption
- keep v0.10.48 strictly observe-only / blocked; it does not unlock ETF execution advice
- add the Index Explainability / Score Breakdown layer as `npm run index:explain`
- add `src/core/formula_registry.mjs` for registered formulas behind displayed indexes
- write `index_explainability.json` and `.md` from flow review, rotation history, module review, ETF readiness, daily analysis, ETF flow leaderboard, signal attribution, watchlist state, decision gate ledger, maturity audit, data reality audit, provider history, provider CSV exports, and optional graph scores
- publish `financial-pond/data/index_explainability.json`
- add a homepage "指数详情解释" panel with the boundary "解释指数来源和公式，不是交易指令。"
- explain displayed readiness, score, rank, watchlist, gate, and maturity numbers with source files, fields, raw inputs, formula, components, calculation steps, data reality, caveats, and execution boundary
- report `formula_registry_missing` if a displayed index lacks a registered formula
- update `fp:summary` with explainability status, explained index count, missing explanation count, and top missing explanations
- keep v0.10.47 strictly explainability-focused; it does not unlock ETF execution advice
- add the Decision Gate Ledger / Readiness Explanation layer as `npm run decision:gates`
- write `decision_gate_ledger.json` and `.md` from ETF readiness, watchlist state, attribution, ETF flow leaderboard, daily analysis, rotation history, module review, flow review, data reality audit, provider history, and optional graph scores
- publish `financial-pond/data/decision_gate_ledger.json`
- add a homepage "决策闸门账本" panel with the boundary "解释为什么不能执行，不是交易指令。"
- explain why provider flow can be ready while execution remains blocked
- track provider, coverage, attribution, watchlist, valuation/fundamental, rotation, graph snapshot, data reality, and execution-language gates in one ledger
- update `fp:summary` with execution state, gate counts, top blockers, next unlock sequence, and provider-ready-but-execution-blocked consistency
- keep v0.10.46 strictly readiness-explanation focused; it does not unlock ETF execution advice
- add the Watchlist State Machine / Conflict Handling layer as `npm run watchlist:state`
- write `sector_watchlist_state.json` and `.md` from daily analysis, signal attribution, ETF flow leaderboard, readiness, rotation, module review, and flow review
- publish `financial-pond/data/sector_watchlist_state.json`
- add a homepage "观察清单状态" panel with the boundary "观察清单，不是交易指令。"
- convert attribution conflicts into `conflict_review`, positive-flow single-line evidence into `flow_only_candidate`, strong-rotation single-line evidence into `rotation_only_candidate`, and weak rows into avoid/deteriorating states
- add execution boundaries and first-run `state_change: new` labels
- keep v0.10.45 strictly observation-focused; it does not unlock ETF execution advice
- add the Signal Attribution / Decision Explanation layer as `npm run signal:attribution`
- write `sector_signal_attribution.json` and `.md` from daily analysis, ETF flow leaderboard, rotation, module review, ETF readiness, and optional graph scores
- publish `financial-pond/data/sector_signal_attribution.json`
- add a homepage "行业信号归因" panel with the boundary "解释观察结果，不是交易指令。"
- expose cross-module conflicts when ETF flow rank #1 differs from the daily leader, when positive ETF flow has a weak daily tier, or when strong rotation has zero/negative ETF flow
- update `fp:summary` with attribution headline, conflict count, first conflict, and top attribution rows
- keep v0.10.44 strictly explainability-focused; it does not unlock ETF execution advice
- move AKShare provider flow from `baseline_only` to `flow_ready` with two real provider dates, 2026-07-07 and 2026-07-08
- move ETF readiness from `not_ready` to `watch_only`; daily conclusion is brokerage leading, watch only, and not an ETF buy instruction
- add `npm run fp:summary` for a compact local progress summary across provider flow, daily analysis, readiness, maturity, and blockers
- add an observation-only ETF true-flow leaderboard JSON/Markdown contract and publish it to the frontend
- add a homepage "ETF 真实资金流观察" panel that separates positive, negative, and zero estimated-flow rows and labels the data as not a buy instruction
- make the one-command runner recover missing `graph_scores.json` by running cycle before pool analysis, and record cycle/pool failures as noncritical instead of hiding them
- keep remaining blockers explicit: valuation/fundamental manual seed, pool graph snapshot dependency, rotation visibility low, and execution decision still blocked
- add daily decision tickets so priority, confirmation, and avoid rows have upgrade and failure conditions for human review
- add provider-history diagnostics so `baseline_only` shows the exact provider CSV dates and whether a previous trade-date baseline exists
- persist AKShare provider CSV history in the daily Action so future runs can keep a usable `previous_share` baseline
- add `npm run provider:akshare:history` so provider CSV history can be audited without running the full model pipeline
- add `npm run project:maturity` and a homepage module-completion panel so low-maturity modules and recommended mainline are visible
- add rotation-continuation diagnostics to daily sector analysis so priority, confirmation, and avoid rows explain whether a sector is extending, reversing, newly strong, or newly weak
- show rotation-continuation labels as visible chips in the homepage Daily Sector Analysis panel
- preserve confirmed rotation leader scores in Daily Sector Analysis when real-provider baseline flow scores are compressed
- add ETF share-change diagnostics so the site can show whether estimated-flow is blocked by missing latest_share, previous_share, share_change, or estimated_flow
- add daily decision-gap checks so the homepage explains which ETF gates passed and which still block execution language
- normalize daily sector names to Chinese labels before rendering
- recover recent published sector-rotation history from Git so trend samples are less likely to be lost
- require deeper GitHub Actions checkout history for the daily workflow
- add a daily published-data completeness guard so missing decision JSON fails CI
- prevent silent partial publishes when ETF readiness, module review, or data audit is absent
- add a first-screen Provider Status panel for AKShare environment, real provider run, ETF share-flow readiness, trend samples, valuation source, and next command
- make the next operational step visible from the website instead of requiring JSON inspection
- keep the ETF decision-readiness gate visible even when all candidates are blocked
- translate ETF readiness blockers into user-facing Chinese
- keep blocked representative sectors visible as pending watch items instead of
  showing an empty watchlist
- regenerate packaged ETF readiness and data reality audit JSON
- preserve the model intent in plain language
- keep the project resumable from a standalone zip
- record the user's investment objective and wording preferences
- add an executable A-share sector ETF flow review layer
- keep wide external factors separate from domestic market confirmation
- add a strict AKShare export to Flow Engine observation bridge
- make the Flow Engine isolation test stable on macOS without changing model behavior
- make provider comparison count only usable quote fields as cross-check evidence
- keep efinance real probing fast and conservative by avoiding noisy sh/sz prefix attempts
- add a bounded AKShare month-backfill command for historical ETF price and
  provider-supported historical share data
- fix release packaging so the zip extracts into a top-level
  `financial-pond-framework/` directory
- mark incomplete historical provider backfills as `partial` instead of
  implying the full 11-sector history is complete
- mark completely unavailable historical backfills as `no_history_available`
  instead of a hard failure
- add `npm run a-share:daily` as the stable daily A-share workflow
- add A-share water-level provider and observations for broad market liquidity
- add a dedicated A-share daily scheduler
- add an independent news intelligence module that writes separate news observations and review outputs
- make the Financial Ponds frontend readable for A-share sector review, news pressure, and data boundaries
- add independent valuation, fundamental, and flow/price sector modules with a cross-tab decision label
- add a data reality audit so mock, fixture, manual seed, and derived layers cannot be mistaken for live market data
- make Flow Review availability source-aware so mock inputs cannot be labeled as ETF-flow-ready market evidence
- add ETF decision readiness as a gatekeeper before any ETF action language

## User Objective

The user wants to build a practical cross-asset market model for ETF allocation.

Near-term focus:

- A-share ETF layout for the second half of the year
- industry ETF analysis, especially policy-sensitive and flow-sensitive sectors
- global ETF layout later, including US equity exposure and other major pools
- reduce reliance on single-stock guesses by moving toward structured ETF pools

The model should help answer:

- where capital is entering
- where capital is leaving
- whether hard data confirms market stories
- whether a sector ETF is supported by liquidity, policy, flow, and confirmation
- whether a cross-market move is likely driven by upstream liquidity or local factors

The project is not meant to blindly predict tomorrow's price. It should first
build a disciplined signal framework, then later add backtesting and decision
support.

## Core Model Memory

Global financial markets are treated as connected capital ponds.

Important concepts:

- `Node`: reusable signal or observation
- `Pool`: capital pond, such as A-shares, US equities, gold, BTC, or a sector
- `Edge`: configured influence path between nodes, pools, assets, and portfolio
- `Asset`: investable ETF, index, stock, or crypto instrument
- `Portfolio`: user holdings, watchlists, or planned allocation
- `Observation`: collector output that enters the graph
- `Snapshot`: dated output that makes the model reproducible

The most important engineering rule:

```text
Financial assumptions live in config, not in core engine code.
```

Core code may load, validate, normalize, score, propagate, explain, and store.
Core code must not contain market-specific rules such as "gold reacts this way"
or "A-shares always use this one indicator".

## Pool Closure Rule

Each pool must remain internally understandable as a closed module:

```text
inputs -> internal components -> final score -> explanation -> downstream output
```

Shared internal components:

- upstream
- inflow
- retention
- downstream diffusion
- news expectation
- market confirmation
- regime adjustment

External nodes and other pools can influence a pool through edges, but the pool's
internal structure must be visible in config and documentation.

## Data Philosophy

Hard data and news are separate lanes.

Hard data means money has already moved or market participants have already
acted. Examples:

- ETF flow
- turnover
- breadth
- margin financing
- northbound or southbound flow
- rate, yield, credit spread, and liquidity data
- exchange statistics
- on-chain liquidity or stablecoin supply

News means expectations may change. News must become a structured event, then a
node observation. News must not directly set final pool score.

Current news flow:

```text
collect -> deduplicate -> classify -> channel mapping -> score -> observation -> market confirmation
```

## Current v0.5 Capabilities

Working commands:

```bash
npm test
npm run demo
npm run daily
npm run cycle
npm run scheduler
npm run export:web-data
npm run web
```

Current working pieces:

- config-driven graph
- major pools: US equities, A-shares, BTC, gold
- sector pool example: A-share semiconductor
- asset and portfolio example
- mock collector fallback
- HTTP CSV collector skeleton
- RSS news collector skeleton
- normalization profiles
- node layer summaries
- daily reports
- graph snapshots
- web dashboard data export
- twice-daily scheduler
- formal architecture diagrams
- recovery and rewrite guides

## Missing Or Incomplete Pieces

The next assistant or engineer should not assume these are already complete:

- real A-share data adapters
- ETF flow data for China market
- northbound and southbound flow integration
- margin financing and short-interest style indicators
- insurance, pension, mutual fund, and public fund flow indicators
- sector ETF universe management
- regime engine implementation beyond the documented concept
- proper news deduplication and semantic classification
- AI-assisted event classifier
- historical backtest module
- allocation or risk decision layer
- portfolio upload and attribution module
- production web deployment wiring

## Current v0.9.0 Focus

The current package adds the first executable A-share sector ETF Flow Engine.

Main command:

```bash
npm run flow:review:fixture
```

With dated observations:

```bash
npm run cycle 2026-07-03
npm run flow:review -- --as-of 2026-07-03
```

The Flow Engine answers:

```text
Which A-share sector ETF pools show stronger or weaker relative flow pressure?
```

It combines:

- direct-flow proxy
- market confirmation
- market liquidity
- policy sentiment
- fundamental proxy
- external wide-factor effect

Critical design decision:

```text
Do not create overly precise causal nodes for single companies or single
headlines. Map external events into wide factors, then require A-share trading
data to confirm them.
```

Example:

```text
overseas semiconductor selloff
-> global_tech_risk negative
-> pressure review for A-share technology sector pools
-> A-share ETF price, turnover, breadth, and later share-change data confirm or
   reject the pressure
```

Flow Engine outputs are review reports, not trading commands.

## Current v0.10.20 Addition

The package adds the first independent sector module layer:

```text
FP-MOD-01 Sector Module Review
```

Command:

```bash
npm run module:review -- --as-of 2026-07-02
```

Inputs:

```text
model_outputs/<date>/sector_flow_review.json
config/model/sector_module_profiles.json
config/sector_catalog/a_share_industry_etfs.json
```

Output:

```text
model_outputs/<date>/sector_module_review.json
model_outputs/<date>/sector_module_review.md
financial-pond/data/sector_module_review.json
```

Design boundary:

```text
valuation module: only answers whether the sector is cheap or expensive
fundamental module: only answers whether earnings/ROE/cycle quality is improving or deteriorating
flow_price module: imports the existing ETF flow and price-volume review
decision label: combines the three labels for readability, but does not rewrite any module score
```

The first profile file is a manual seed:

```text
config/model/sector_module_profiles.json
```

It is intentionally editable. Later real PE/PB/dividend/ROE/earnings providers
can replace these fields while preserving the same JSON contract.

## Current v0.10.21 Addition

The package adds the data reality audit:

```text
FP-AUDIT-01 Data Reality Audit
```

Command:

```bash
npm run data:audit -- --as-of 2026-07-02
```

Output:

```text
model_outputs/<date>/data_reality_audit.json
model_outputs/<date>/data_reality_audit.md
financial-pond/data/data_reality_audit.json
```

The audit checks:

```text
flow_price
news
sector_modules
sector_rotation
general_pool_analysis
rotation_history
```

Current packaged audit result:

```text
overall_reality: mixed_non_real
flow_price: mock
news: fixture
sector_modules: manual_seed
sector_rotation: derived_from_non_real
general_pool_analysis: contract_output_source_unverified
rotation_history: derived_from_non_real
```

Strict reading rule:

```text
If data_reality_audit.json says mixed_non_real, the website can be used to inspect
model structure and data contracts, but not as a live ETF decision aid.
```

## Current v0.10.22 Addition

The Flow Review availability contract is now source-aware.

New fields:

```text
data_availability.source_reality
data_availability.market_use_confidence
data_availability.source_counts
data_availability.counts.observed_direct_flow_inputs
data_availability.counts.representative_observed_direct_flow_inputs
data_availability.counts.observed_price_volume_confirmations
data_availability.counts.representative_observed_price_volume_confirmations
```

If all active inputs come from mock or fixture sources, the mode is:

```text
mock_only
```

Downstream effect:

```text
sector_rotation_intelligence.evidence_level = mock_only
```

This closes the earlier ambiguity where component coverage could be full while
source reality was still non-real.

## Current v0.10.23 Addition

The Data Reality Audit now includes real-provider run status:

```text
akshare_provider_run
```

It reads:

```text
model_outputs/provider_runs/akshare_etf_bridge_<date>.json
```

Current local probe:

```text
provider_run_failed
AKShare is not installed. Run `python3 -m pip install akshare` or use --fixture.
```

This turns the next real-data blocker into a visible dashboard layer instead of
leaving it hidden in terminal logs.

## Current v0.10.24 Addition

The AKShare provider has a doctor/preflight command:

```bash
npm run provider:akshare:doctor
npm run provider:akshare:doctor:probe
```

It writes:

```text
model_outputs/provider_runs/akshare_etf_bridge_doctor.json
```

The command checks:

```text
python_runtime
akshare_import
fund_etf_spot_em, only with --probe-endpoint
```

The real daily path now runs the doctor before exporting provider data.

Current local blocker:

```text
akshare_import blocked: No module named 'akshare'
```

CI install path:

```bash
python -m pip install -r tools/financial-pond-framework/providers/requirements.txt
```

## Current v0.9.1 Addition

The package adds:

```text
npm run provider:akshare:to-flow
```

This command reads:

```text
data/provider_exports/a_share_etf_daily.csv
```

and writes:

```text
observations/<date>/provider_flow_observations.json
model_outputs/<date>/akshare_provider_flow_observations.json
model_outputs/<date>/akshare_provider_flow_observations.md
```

Strict rule:

```text
estimated_flow missing -> do not emit direct ETF-flow observation
```

Baseline-only AKShare runs still emit market-confirmation inputs from
`pct_change` and `amount rank`, but they do not create fake flow.

## Current v0.9.2 Addition

The package fixes a macOS test fragility found in the user's terminal log.

Observed state:

```text
provider:akshare:to-flow -> succeeded
flow:review -- --as-of 2026-07-02 -> succeeded
npm test -> one isolated Flow Engine CLI test failed on a temporary-directory output assertion
```

Decision:

```text
The model pipeline was working. The failing check was a brittle test harness,
not a flow-model failure.
```

The test now calls the exported `runSectorFlowReview` function with an isolated
temporary root directory. It still verifies that output is written under the
temporary root and that graph scores and source status are not changed.

## Current v0.9.3 Addition

The user's provider-lab run showed:

```text
AKShare: ok, 11 rows, quote fields available
efinance: ok, 11 rows, but close/pct_change/amount/volume/turnover all missing
qstock: dependency_error on local macOS native py-mini-racer binding
```

Decision:

```text
Provider rows are not enough. A backup provider must have usable quote fields
before it can raise model confidence.
```

The comparison report now separates:

```text
providers_available
quote_providers_available
multi_provider_rows
cross_checked_quote_rows
```

This prevents empty efinance rows from being treated as cross-checked ETF quote
evidence.

## Current v0.9.4 Addition

The user's macOS run showed `provider:efinance:probe` printing repeated:

```text
证券代码 "sh512000" 可能有误
证券代码 "SH512000" 可能有误
```

Cause:

```text
v0.9.3 tried sh/sz-prefixed ETF codes while probing efinance. efinance treats
those ETF prefixes as invalid and can wait on every attempt.
```

Fix:

```text
efinance real probe now uses only the canonical six-digit fund code.
npm test no longer calls the real efinance endpoint.
```

This does not change AKShare exports, Flow Review, graph scoring, or ETF-flow
readiness.

## Current v0.9.5 Addition

The package adds:

```text
npm run provider:akshare:backfill-month
npm run provider:akshare:backfill-month:fixture
```

Purpose:

```text
Try to backfill about one month of A-share industry ETF history through the same
provider file boundary.
```

Important distinction:

```text
Historical ETF price, pct_change, amount, and turnover can be requested from
AKShare's ETF history endpoint.

Historical ETF shares are only used when AKShare exposes provider-supported
historical share rows for the date. If shares are missing, estimated_flow stays
empty.
```

This means a backfill may be useful immediately for:

- price trend
- turnover / amount trend
- relative strength
- heat ranking

But it is only useful for real ETF net-flow history when `latest_share` is
available across dates for the representative ETF.

Strict rule:

```text
No historical share -> no share_change -> no estimated_flow.
```

## Current v0.9.6 Addition

The user's v0.9.5 terminal output showed two separate issues:

```text
1. The zip extracted directly into Downloads instead of a financial-pond-framework
   folder, so `cd financial-pond-framework` failed and later outputs were written
   under /Users/cosec/Downloads.

2. Real AKShare month backfill returned only 5 of 11 representative ETFs because
   several historical price requests failed with SSL errors. The command still
   wrote useful partial history, but `validate` reported the missing sectors.
```

The v0.9.6 package fixes the first problem in packaging and makes the second
problem explicit:

```text
backfill status: ok      -> all representative ETF histories were observed
backfill status: partial -> some representative ETF histories were missing
validate status: partial -> files are readable, but history/flow coverage is incomplete
validate status: error   -> structural problem, missing files/columns, or failed run
```

Operational rule:

```text
If historical backfill is partial, do not treat the flow review as a complete
11-sector funding map. It is still useful as partial evidence, but missing
sectors must stay low-confidence until daily AKShare exports accumulate local
share history.
```

## Current v0.9.7 Addition

The user's v0.9.6 terminal output showed:

```text
npm test -> 44 pass
provider:akshare:backfill-month -> historical endpoint returned no representative ETF rows
provider:akshare -> current-day 11 ETF snapshot succeeded
provider:akshare:validate -> baseline_only
provider:akshare:to-flow -> 22 observations
flow:review -> 11 sectors reviewed from price/amount proxy only
```

Decision:

```text
Historical backfill failure should not be confused with daily data failure.
```

v0.9.7 changes:

```text
backfill status no_history_available
  = AKShare historical endpoint returned zero representative ETF rows.
  = Daily snapshots can still work.
  = Real flow must be accumulated from future daily runs.

npm run a-share:daily
  = provider:akshare
  + provider:akshare:validate
  + provider:akshare:inspect
  + provider:akshare:to-flow
  + flow:review
```

Current analytical state after the user's run:

```text
Available:
- 11 current ETF prices
- 11 current ETF pct_change values
- 11 current ETF amount values
- 11 current ETF latest_share values
- relative-strength and amount-heat observations

Unavailable:
- historical ETF flow from backfill
- same-provider historical quote coverage
- direct ETF net-flow observations
```

## Current v0.9.8 Addition

The project now adds an A-share market-water layer.

Main idea:

```text
ETF flow answers: is money entering a specific ETF?
A-share water level answers: is the whole A-share market active enough to
support sector rotation?
```

New commands:

```bash
npm run provider:a-share-water
npm run provider:a-share-water:to-observations
npm run a-share:daily
npm run scheduler:a-share
```

The stable daily command is now:

```text
provider:akshare
provider:a-share-water
provider:akshare:validate
provider:akshare:inspect
provider:akshare:to-flow
provider:a-share-water:to-observations
flow:review
```

The water-level provider currently emits:

```text
a_share_turnover
a_share_breadth
margin_balance, only if provider data is available
```

These observations enter Flow Review through:

```text
market_liquidity
```

Boundary:

```text
High turnover and strong breadth improve market-water context.
They do not prove ETF net inflow.
```

## v0.6 Additions

The `0.6.0` package adds:

- `docs/PROJECT_MEMORY.md` as the main recovery document
- `docs/ROADMAP.md` for future work
- `docs/CHANGELOG.md` for version tracking
- `config/model/regime_rules.json`
- `src/model/regime_engine.mjs`
- `model_outputs/<date>/regime_summary.json` generated by `npm run cycle`
- `config/news/search_queries.json`
- `src/collectors/news_search_collector.mjs`

Important boundary: regime summaries are read-only model context in this
version. They do not change graph scores. News search also emits node
observations only.

## v0.6.1 Additions

The `0.6.1` package begins the first practical ETF direction model:

- A-share industry ETF factor nodes
- semiconductor sector ETF confirmation nodes
- S&P 500 pool
- S&P 500 ETF demo asset
- S&P 500 ETF flow, breadth, earnings, valuation, buyback, mega-cap, and
  policy/news nodes
- `docs/ETF_FLOW_MODEL.md`
- `config/reporting/default_entities.json`

The reporting entity list is now config-driven. Future pools and ETF assets can
appear in the report without editing pipeline code.

## v0.6.2 Additions

The `0.6.2` package turns A-share industry ETFs into a catalog-driven extension:

- `config/sector_catalog/a_share_industry_etfs.json`
- `src/tools/materialize_sector_catalog.mjs`
- `npm run materialize:sectors`
- 11 materialized A-share industry ETF pools
- demo ETF assets for each materialized sector
- sector template nodes for flow, policy news, relative strength, breadth,
  leader confirmation, and fundamentals

This version makes the industry layer expandable without editing core graph
code.

## v0.6.3 Additions

The `0.6.3` package adds an explicit module status document:

- `docs/MODULE_STATUS.md`

This file records which parts are working, which parts are skeletons, which
parts are configured placeholders, and which parts are planned. It also records
the rule that every meaningful package or architecture update must update
`docs/CHANGELOG.md`.

## v0.7.0 Additions

The `0.7.0` package begins the real-data ingestion layer:

- `src/collectors/local_csv_collector.mjs`
- `src/collectors/http_json_collector.mjs`
- `src/tools/source_status_report.mjs`
- `npm run sources:status`
- `docs/DATA_INGESTION_V0_7.md`
- `btc_price_momentum` node

Real sources remain disabled by default. This version adds safer ingestion
infrastructure before enabling production data feeds.

## v0.7.1 Additions

The `0.7.1` package records the first open-source provider decision for
A-share industry ETF data:

- `docs/OPEN_SOURCE_DATA_PROVIDER_COMPARISON.md`
- `config/data_providers/open_source_candidates.json`
- `tests/data_provider_candidates.test.mjs`

Provider order:

1. `akshare` as the primary A-share ETF data candidate.
2. `efinance` as the quote-history fallback.
3. `tushare` as an optional token-based structured source.
4. `mootdx` as a low-priority Tongdaxin quote fallback.
5. `qlib` as a future research/backtest reference, not ingestion v1.

The provider decision is intentionally outside the core model. The next adapter
should export local CSV or JSON files that existing collectors read.

## v0.7.2 Additions

The `0.7.2` package adds the first provider bridge:

- `providers/akshare_etf_bridge/README.md`
- `providers/akshare_etf_bridge/provider_contract.json`
- `providers/akshare_etf_bridge/export_a_share_etf_daily.py`
- `docs/AKSHARE_ETF_BRIDGE.md`
- `npm run provider:akshare:fixture`
- `npm run provider:akshare`

The fixture command writes:

```text
raw_data/provider/akshare/<date>/a_share_etf_daily_raw.json
data/provider_exports/a_share_etf_daily.csv
data/provider_exports/a_share_sector_flow.csv
model_outputs/provider_runs/akshare_etf_bridge_<date>.json
```

The provider bridge is outside `src/core`. It is a file-export boundary, not a
model-scoring component. The scheduled pipeline still uses mock data by default.

## v0.7.3 Additions

The `0.7.3` package adds provider export validation and completes disabled
collector templates for all A-share industry ETF-flow columns:

- `providers/akshare_etf_bridge/validate_exports.py`
- `npm run provider:akshare:validate`
- disabled `akshare_bridge_*_etf_flow` local CSV sources for all 11 sectors

Build-environment note:

- AKShare was not installed.
- Package installation was not available during this run.
- Real AKShare export is still pending.
- Fixture export and validation work offline.

All provider-export collectors remain disabled by default, so daily scoring is
unchanged unless a source is manually enabled.

## v0.7.4 Additions

The user installed AKShare 1.18.64 locally and ran the real provider command.
The real run failed with:

```text
fund_etf_scale_sse() got an unexpected keyword argument 'symbol'
```

The `0.7.4` package fixes this by retrying AKShare endpoint calls without the
unsupported keyword argument when AKShare reports signature drift. It also makes
`npm run provider:akshare:validate` check the latest bridge run-status file by
default, so a failed real run is not hidden by old fixture CSV files.

## v0.7.5 Additions

The user reran v0.7.4 locally. The real provider command failed with:

```text
name 'compact_date' is not defined
```

The `0.7.5` package restores `compact_date` and adds a fake-AKShare real-path
test so the no-`symbol` endpoint branch is covered by automated tests.

## v0.7.6 Additions

The user reran v0.7.5 locally. The real provider command reached AKShare but
failed on the optional Shenzhen ETF scale endpoint:

```text
HTTPSConnectionPool(host='fund.szse.cn', port=443) ... SSLEOFError
```

The `0.7.6` package treats share/scale endpoints as optional enrichment. If
`fund_etf_scale_sse` or `fund_etf_scale_szse` fails, the bridge records a
warning and still writes row-level quote data from `fund_etf_spot_em`.
Validation remains strict enough to warn or fail when ETF-flow columns are not
complete.

## v0.7.7 Additions

The user confirmed the `0.7.6` package on macOS:

- package version: `0.7.6`
- `npm test`: 31 passed, 0 failed
- `npm run provider:akshare`: real mode, `status: ok`, 11 records
- `npm run provider:akshare:validate`: `status: ok`

However, the `0.7.6` zip still contained build-time output files. The validation
report therefore showed sample dates from fixture/test runs. The `0.7.7` package
keeps code behavior unchanged and creates a clean release zip that excludes
runtime output directories.

## v0.7.8 Additions

The `0.7.8` package adds a provider-output inspection layer for AKShare:

```bash
npm run provider:akshare:inspect
```

The inspector reads provider export CSV files and writes:

- `model_outputs/provider_inspection/akshare_etf_bridge_inspection.json`
- `model_outputs/provider_inspection/akshare_etf_bridge_inspection.md`

Purpose:

- review real ETF code coverage
- check whether latest price, amount, share, and estimated flow values exist
- rank representative sector ETFs by turnover and estimated flow
- produce source-level recommendations such as `candidate_for_manual_review`
  or `keep_disabled`

Boundary:

- the inspector does not call AKShare
- the inspector does not change source configs
- the inspector does not enable collector sources
- the inspector does not import or modify graph-core code

## v0.7.9 Additions

The user's first clean `0.7.8` real AKShare run succeeded, but validation
returned an error because all ETF-flow columns were empty. Inspection showed why:

```text
estimated_flow is missing
```

This is expected on the first clean real run. AKShare provided latest price,
amount, and latest share, but there was no previous local share baseline yet.
Without a previous date, the bridge cannot calculate share change or estimated
flow.

The `0.7.9` package changes validation semantics:

- row-level quote data can validate as `ok`
- ETF-flow readiness is reported separately as `flow_readiness`
- a first clean run with one date and empty flow columns becomes
  `flow_readiness.status = baseline_only`
- ETF-flow local CSV sources must still remain disabled until a later trading
  date creates share-change history

Core graph behavior is unchanged.

## v0.8.0 Additions

The `0.8.0` package adds Provider Lab for multi-provider comparison:

```bash
npm run provider:efinance:probe
npm run provider:qstock:probe
npm run providers:compare:a-share-etf
```

Offline fixture commands:

```bash
npm run provider:efinance:probe:fixture
npm run provider:qstock:probe:fixture
```

Purpose:

- check whether `efinance` can provide ETF quote backup fields
- check whether `qstock` can provide ETF, industry-board, and concept-board
  structure data
- compare AKShare, efinance, and qstock outputs for the representative A-share
  industry ETF universe

Boundary:

- Provider Lab does not enable collector sources
- Provider Lab does not write observations
- Provider Lab does not modify graph-core code
- Provider Lab does not change final scores

## Next Priority

Recommended next version: `0.8.1`.

Primary goal:

Run real efinance and qstock probes on the user's macOS environment, then
review the provider comparison report before any source is enabled.

Suggested order:

1. Review representative ETF codes in
   `providers/akshare_etf_bridge/provider_contract.json`.
2. Run a real AKShare export after installing the Python dependency.
3. Run `npm run provider:akshare:validate`.
4. Run `npm run provider:akshare:inspect`.
5. Run `npm run provider:efinance:probe`.
6. Run `npm run provider:qstock:probe`.
7. Run `npm run providers:compare:a-share-etf`.
8. If validation reports `baseline_only`, run the provider again on a later
   trading date before enabling ETF-flow sources.
9. Compare representative ETF names, codes, and values against source pages or
   a second provider.
10. Enable one provider-export source at a time after checking the raw file.
11. Add FRED, Binance, WGC, HKEX, and broader A-share data adapters.
12. Add data contracts for A-share ETF flow, turnover, margin financing, index
   breadth, northbound flow, and sector relative strength.
13. Expand `a_share` and A-share sector pool configs.
14. Add source-quality metadata for each data source.
15. Add tests proving a new sector pool can be added with config only.
16. Add dashboard fields for pool internals, not only final score.
17. Keep all real-data collectors optional so the package still runs offline.

## Current v0.10.28 Addition

The package improves the ETF decision-readiness reading layer:

```text
FP-ETF-01 ETF Decision Readiness
FP-UI-01 Frontend Dashboard
FP-MAINT-01 Maintenance Protocol
```

Command:

```bash
npm run etf:readiness -- --as-of 2026-07-02
npm run data:audit -- --as-of 2026-07-02
```

Output:

```text
model_outputs/<date>/etf_decision_readiness.json
model_outputs/<date>/etf_decision_readiness.md
financial-pond/data/etf_decision_readiness.json
financial-pond/data/data_reality_audit.json
```

Current packaged reading:

```text
guidance_state: not_ready
headline: 暂不能指导买入 ETF：AKShare 真实 provider 今天还没有确认跑通。
top_watchlist: 6 pending representative sectors
```

Important boundary:

```text
The pending watch items are not buy candidates.
They show which representative sectors would be worth watching after data gates unlock.
No scoring weights, provider endpoints, or trade rules changed in v0.10.28.
```

## Current v0.10.29 Addition

The package adds a first-screen Provider Status panel:

```text
FP-UI-01 Frontend Dashboard
FP-DATA-01 Hard Data Providers
```

Data inputs:

```text
financial-pond/data/data_reality_audit.json
financial-pond/data/etf_decision_readiness.json
```

The panel shows:

```text
AKShare environment status
AKShare real provider run status
ETF share-flow coverage
trend sample count
valuation/fundamental source state
next command
```

Current packaged reading:

```text
AKShare environment: provider_doctor_blocked
AKShare run: provider_run_failed
next command: install AKShare requirements, then run provider:akshare:doctor
```

Important boundary:

```text
This is operational guidance only.
It does not change scores, provider collection rules, or ETF action labels.
```

## Current v0.10.35 Addition

The package adds a daily human-review ticket to `FP-DAILY-01`.

The fix:

```text
src/tools/daily_sector_analysis.mjs -> add decision_ticket
financial-pond/app.js -> render 明日决策票
financial-pond/styles.css -> add compact ticket cards
scripts/validate-published-data.mjs -> require decision_ticket.groups
tests/daily_sector_analysis.test.mjs -> lock ticket upgrade/failure conditions
tests/worker.test.mjs -> lock published contract
```

Important boundary:

```text
This does not emit buy, sell, rebalance, or allocation instructions.
The ticket only defines upgrade conditions, failure conditions, and human-review boundaries.
ETF execution language still requires readiness gates to pass.
```

## Previous v0.10.34 Addition

The package hardens the ETF share-change flow gate.

The fix:

```text
src/tools/akshare_flow_observations.mjs -> add share_change_diagnostics
src/tools/etf_decision_readiness.mjs -> expose gates.share_change_diagnostics
src/tools/daily_sector_analysis.mjs -> use diagnostics in decision_gap readings
financial-pond/app.js -> render the ETF 份额变化流 diagnostic card
scripts/validate-published-data.mjs -> require readiness diagnostics
tests/* -> lock converter, readiness, daily, and Worker contracts
```

Important boundary:

```text
This does not synthesize missing ETF share-change flow.
It only shows whether the blocker is latest_share, previous_share, share_change, or estimated_flow.
flow_ready still requires real provider rows with estimated_flow.
```

## Previous v0.10.33 Addition

The package hardens `FP-DAILY-01` after the 3-day rotation chain recovered and
`priority_watch` began populating.

The fix:

```text
src/tools/daily_sector_analysis.mjs -> add decision_gap.checks
src/tools/daily_sector_analysis.mjs -> normalize sector names to Chinese labels
src/tools/daily_sector_analysis.mjs -> prefer recovered rotation-history sample_days when newer than readiness gates
financial-pond/app.js -> render the daily 解锁差距 card
scripts/validate-published-data.mjs -> require decision_gap.checks
tests/daily_sector_analysis.test.mjs -> lock decision-gap and name-normalization behavior
```

Important boundary:

```text
This does not unlock ETF execution advice.
The output remains observation-only while true ETF share-change flow is missing.
It does not emit buy, sell, rebalance, or allocation instructions.
```

## Previous v0.10.32 Addition

The package hardens `FP-HIST-01` after a real daily run showed:

```text
sector_rotation_history.sample_days = 2
history = 2026-07-02, 2026-07-07
persistent_leaders = []
```

even though a prior published state had already shown a longer history chain.

The fix:

```text
.github/workflows/daily.yml -> actions/checkout fetch-depth: 30
src/tools/sector_rotation_history.mjs -> read recent Git versions of financial-pond/data/sector_rotation_history.json
src/tools/sector_rotation_history.mjs -> merge history arrays by as_of
tests/sector_rotation_history.test.mjs -> recovery regression test
```

Important boundary:

```text
This does not invent missing market samples.
It only recovers rotation snapshots already committed in recent published data.
It does not change sector scores, provider endpoints, or ETF readiness gates.
```

## Previous v0.10.31 Addition

The package adds a daily sector analysis layer:

```text
src/tools/daily_sector_analysis.mjs
npm run daily:sector-analysis
financial-pond/data/daily_sector_analysis.json
```

The output combines:

```text
sector_flow_review.json
sector_rotation_history.json
sector_module_review.json
etf_decision_readiness.json
data_reality_audit.json when available
```

It writes three observation tiers:

```text
priority_watch
confirm_next
avoid_watch
```

The homepage now has a `今日行业结论` panel before the reference panel.
The GitHub Action regenerates and publishes `daily_sector_analysis.json`, and
`validate:data` now requires it.

Important boundary:

```text
This is an observation layer.
When ETF readiness is not_ready, strong sectors remain watch-only.
It does not output buy, sell, rebalance, or allocation instructions.
```

## Previous v0.10.30 Addition

The package adds a daily published-data completeness guard:

```text
scripts/validate-published-data.mjs
npm run validate:data
```

The GitHub Action now runs:

```text
npm run validate:data
npm run build
npm run validate
npm test
```

The guard requires:

```text
sector_module_review.json
etf_decision_readiness.json
data_reality_audit.json
```

plus the rest of the web JSON contract.

Important boundary:

```text
This update does not change any market score or provider endpoint.
It only prevents the site from silently publishing incomplete decision data.
```

## User Preferences

Response and documentation preferences:

- Explain from definitions, mechanisms, data flow, dependencies, and boundary
  conditions.
- Avoid loose metaphors when the user asks for technical explanation.
- Keep project documents readable after version loss.
- Prefer short, clear notes that a future assistant can continue from.
- Avoid the specific Chinese verb the user rejected in prior discussion.
- When making packages, preserve purpose in code comments and human-readable
  documents so version confusion does not block future work.

## Do Not Break

These rules have higher priority than style cleanup:

- Do not hardcode financial meaning into core engine code.
- Do not let news directly set pool score.
- Do not let UI calculate financial logic.
- Do not let backtests mutate current scoring rules.
- Do not remove recovery documents when creating a new zip.
- Do not replace config-driven extension with market-specific branches.


## Current v0.10.0 Addition

This version adds the first independent news intelligence layer.

Files:

- `config/news/news_daily_v1.json`
- `src/news/news_intelligence.mjs`
- `src/tools/news_daily_review.mjs`

Outputs:

- `observations/<date>/news_observations.json`
- `model_outputs/<date>/news_review.json`
- `model_outputs/<date>/news_review.md`

Boundary:

- News is expectation pressure.
- News does not prove ETF inflow or outflow.
- Flow Review can read news observations, but the core graph snapshot remains independent.
- Market confirmation still comes from hard data: price, turnover, breadth, ETF share change, and water-level data.

The Financial Ponds frontend was also simplified so a non-technical reader first sees:

- current model stage
- A-share sector ranking
- main drivers
- news pressure
- data boundaries

The low-level graph is no longer the primary reading experience.
