# Changelog

## v0.10.4 - Reference-first dashboard

- Bumped site and framework package versions to `0.10.4`.
- Added a `今日参考面板` to the page top.
- The panel summarizes:
  - strongest sector;
  - weakest / outflow-watch sector;
  - technology-chain composite score;
  - ETF-flow input count;
  - price/volume confirmation count;
  - average confidence and completeness;
  - whether the news layer is real or fixture/fallback.
- Added `data completeness` and `confirmation input` columns to the sector table.
- Demoted old global graph scores to technical context by explicitly stating that mock graph scores are not the main reference view.

Boundary:

- No scoring formula change.
- No new data provider.
- No GPT integration.
- No trading recommendation.

Progress registry:

- `docs/handbook/CURRENT_PROGRESS_V0_10_4.md`

## v0.10.3 - Usable dashboard state and project semantics cleanup

- Bumped site and framework package versions to `0.10.3`.
- Added `docs/handbook/CURRENT_PROGRESS_V0_10_3.md`.
- Added `docs/handbook/DATA_STATUS_MATRIX.md`.
- Added `docs/handbook/FRONTEND_MODEL_CONTRACT.md`.
- Clarified that `electric_power` is a watchlist/demo pond, not a real ETF-backed sector in this package.
- Aligned published frontend JSON dates so the dashboard does not show a future `as_of`.
- Clarified that runtime folders such as `observations/`, `snapshots/`, `model_outputs/`, and `reports/` are sample state in this package.
- Changed the site language metadata to Simplified Chinese.

Boundary:

- No scoring formula change.
- No GPT integration.
- No automatic graph or keyword writeback.
- No new real data provider.

## v0.10.2 - Adaptive graph feedback and progress registry

- Added clickable graph feedback UI for local upstream/downstream node edits.
- Added proposal display for node additions, weight changes, and edge decay.
- Added patch export from browser localStorage.
- Added the first numbered progress registry, later superseded by `docs/handbook/CURRENT_PROGRESS_V0_10_4.md`.
- Numbered formed and planned modules from FP-00 to FP-10.
- Recorded deployment state, A-share data provider state, news engine boundary, adaptive keyword design, adaptive graph feedback design, frontend UX structure, tests, and next recommended implementation order.
- Purpose: make future editing safer and prevent confusion between implemented modules, prototypes, and planned modules.

## v0.10.1 - Clickable pond map dashboard

- Added `financial-pond/data/pond_map.json`.
- Updated frontend to show all ponds by hierarchy.
- Added pond detail view with upstream/downstream nodes, influence coefficients, keyword groups, weights, half-life, splash coefficient, related sectors, and daily/weekly report placeholders.
- Added electricity-sector watchlist example to express adaptive upstream/downstream logic.

Boundary:

- Electricity was added as a frontend watchlist/demo pond only.
- It is not yet connected to real ETF data or the sector flow engine.

## 0.9.9

Source package: `0.9.8` plus the first GitHub Actions failure from
`a_share_water_level_provider`, where AKShare's broad A-share quote endpoint
closed the remote connection in CI.

Changes:

- Added `src/tools/a_share_daily_ci.mjs`.
- Added `npm run a-share:daily:ci`.
- Updated `.github/workflows/daily.yml` to use the CI runner.
- The CI runner still fails hard if the ETF snapshot, validation, conversion,
  or Flow Review fails.
- The CI runner treats only the broad A-share water-level provider as
  fallback-capable:
  - first tries real AKShare water-level data;
  - if the remote endpoint disconnects or errors, writes deterministic fixture
    water-level data for that date;
  - prints `fallback_used: true` and `fallback_reason` in the run summary.

Boundary:

- This fallback is for website continuity in GitHub Actions.
- It does not pretend that fixture water-level data is real market data.
- Local/manual `npm run a-share:daily` remains strict and still fails on a real
  water-level provider error.

## 0.9.8

Source package: local `0.9.7` build plus the decision to stop relying on
historical ETF backfill and add broad A-share market-water signals.

Changes:

- Bumped package version from `0.9.7` to `0.9.8`.
- Added `providers/a_share_water_level/export_a_share_water_level.py`.
- Added `src/tools/a_share_water_observations.mjs`.
- Added `config/schedules/a_share_daily.json`.
- Added `src/scheduler/run_a_share_daily.mjs`.
- Added `docs/A_SHARE_WATER_LEVEL_V0_9_8.md`.
- Added commands:
  - `npm run provider:a-share-water`
  - `npm run provider:a-share-water:fixture`
  - `npm run provider:a-share-water:to-observations`
  - `npm run scheduler:a-share`
- Updated `npm run a-share:daily` so it now runs:
  - AKShare ETF snapshot
  - A-share water-level provider
  - AKShare validation and inspection
  - ETF provider-flow observation conversion
  - water-level observation conversion
  - sector Flow Review
- Flow Review now reads `observations/<date>/a_share_water_observations.json`
  and uses those observations in the `market_liquidity` component.
- Added test coverage proving fixture water-level observations feed Flow Review.

Boundary:

- A-share water level is broad market context, not ETF net flow.
- Direct ETF flow still requires share-change history.
- Margin balance is optional and not directionally scored until local history
  exists.

## 0.9.7

Source package: local `0.9.6` build plus the user's terminal output where the
real AKShare historical backfill returned zero representative ETF rows, while
the current-day AKShare snapshot still succeeded.

Changes:

- Bumped package version from `0.9.6` to `0.9.7`.
- `backfill_a_share_etf_history.py` now reports
  `status: no_history_available` when the historical endpoint returns no
  representative ETF rows.
- A no-history backfill exits successfully and writes a run-status report,
  instead of surfacing as a hard provider exception.
- Added `npm run a-share:daily` for the stable daily A-share workflow:
  - current AKShare snapshot
  - validation
  - inspection
  - provider observations
  - sector flow review
- Added test coverage for the no-history backfill case.

Interpretation:

- Historical backfill can fail while the current-day data path remains healthy.
- The model should then operate in `baseline_only` mode until future daily
  snapshots create local share history.

## 0.9.6

Source package: local `0.9.5` build plus the user's terminal output after real
AKShare month backfill.

Changes:

- Bumped package version from `0.9.5` to `0.9.6`.
- Release zip now extracts into a top-level `financial-pond-framework/`
  directory instead of scattering project files into the current folder.
- `backfill_a_share_etf_history.py` now reports `status: partial` when real
  historical backfill misses representative ETF codes.
- Backfill run status now includes:
  - `representative_codes_observed`
  - `missing_history_codes`
- `validate_exports.py` now distinguishes:
  - `ok`: files and coverage are complete enough for review
  - `partial`: files are readable, but provider coverage or ETF-flow history is incomplete
  - `error`: structural problem, missing file/column, or failed provider run
- `validate_exports.py` exits successfully for `partial` so follow-up inspection
  can still run and show exactly what is missing.
- Added test coverage for partial historical provider output.

Observed real-data boundary:

- In the user's v0.9.5 run, AKShare real month backfill succeeded for 5 of 11
  representative ETFs.
- Six ETF historical price requests failed with SSL errors from the upstream
  Eastmoney history endpoint.
- Shenzhen ETF historical shares were unavailable because the installed AKShare
  `fund_etf_scale_szse` function did not accept a date argument.

Interpretation:

- The model can use partial historical price/amount/share data.
- It cannot treat that run as a complete 11-sector funding map.

## 0.9.5

Source package: local `0.9.4` build plus the user's question about whether one
month of prior ETF records can be fetched.

Changes:

- Added `providers/akshare_etf_bridge/backfill_a_share_etf_history.py`.
- Added `npm run provider:akshare:backfill-month`.
- Added `npm run provider:akshare:backfill-month:fixture`.
- Historical backfill writes to the existing provider files:
  - `data/provider_exports/a_share_etf_daily.csv`
  - `data/provider_exports/a_share_sector_flow.csv`
- Added test coverage for month backfill using deterministic fixture history.
- Updated `PROJECT_STATE.md` and `docs/AKSHARE_ETF_BRIDGE.md` with the recovery
  rule for historical data.
- Bumped package version from `0.9.4` to `0.9.5`.

Important boundary:

- Historical price, pct_change, amount, and turnover can be backfilled when the
  AKShare ETF history endpoint works.
- Historical ETF net flow requires historical share rows.
- Missing historical share rows keep `share_change` and `estimated_flow` empty.
- The script does not fabricate flow from price or amount.

## 0.9.4

Source package: local `0.9.3` build plus the user's macOS output where
`provider:efinance:probe` printed repeated invalid sh/sz ETF-code messages and
appeared to hang.

Changes:

- Removed sh/sz-prefixed ETF-code attempts from the efinance real probe.
- Kept efinance probing to canonical six-digit fund codes.
- Added a test-only environment switch so `npm test` does not call the real
  efinance endpoint on machines where efinance is installed.
- Bumped package version from `0.9.3` to `0.9.4`.

No model-behavior change:

- AKShare remains the primary real provider.
- Empty efinance rows still do not raise cross-provider confidence.
- Flow Review behavior is unchanged.

## 0.9.3

Source package: local `0.9.2` build plus the user's provider-lab terminal
output.

Changes:

- Added provider quote-quality gates to the A-share ETF comparison report.
- `efinance` rows with no close, pct_change, amount, volume, or turnover are
  marked `no_usable_fields` instead of being treated as a valid backup quote
  source.
- Provider comparison now reports:
  - `providers_available`
  - `quote_providers_available`
  - `multi_provider_rows`
  - `cross_checked_quote_rows`
- `qstock` import failures caused by native library or symbol errors are marked
  `dependency_error`, separate from a normal missing package.
- Added test coverage so empty efinance rows cannot raise cross-provider quote
  confidence.
- Bumped package version from `0.9.2` to `0.9.3`.

No model-behavior change:

- AKShare remains the only usable real quote provider until another provider
  returns usable quote fields.
- Flow Review still uses provider observations only through the existing
  observation bridge.

## 0.9.2

Source package: local `0.9.1` build plus the user's macOS terminal output.

Changes:

- Fixed the Flow Engine isolation test that could fail on macOS even when the
  actual provider-to-flow pipeline succeeded.
- Changed the fragile subprocess-based test to call `runSectorFlowReview`
  directly with a temporary root directory.
- Kept the test's purpose: verify isolated model output and confirm the review
  does not change source status or graph scores.
- Bumped package version from `0.9.1` to `0.9.2`.

No model-behavior change:

- `estimated_flow` is still required before direct ETF-flow observations are
  emitted.
- `pct_change` still maps to relative-strength proxy.
- `amount rank` still maps to leader-confirmation proxy.
- `provider:akshare:to-flow` and `flow:review` behavior is unchanged.

## 0.9.1

Source package: local `0.9.0` build plus the user's real v0.8.0 terminal
output showing AKShare row data is available while `estimated_flow` is still
`baseline_only`.

Changes:

- Added `src/tools/akshare_flow_observations.mjs`.
- Added `npm run provider:akshare:to-flow`.
- Updated Flow Engine review to merge
  `observations/<date>/provider_flow_observations.json` when present.
- Added `docs/FLOW_ENGINE_V0_9_1_AKSHARE_INPUTS.md`.
- Added tests for:
  - flow-ready AKShare fixture export
  - baseline-only export without fake ETF-flow observations
  - Flow Engine review from provider-flow observations
- Bumped package version from `0.9.0` to `0.9.1`.

Important boundary:

- Missing `estimated_flow` stays missing.
- `pct_change` maps only to relative-strength proxy.
- `amount` maps only to attention or confirmation heat.
- The converter does not enable collector sources or modify graph scores.

## 0.9.0

Source package: local `0.8.0` build plus the project decision to use elastic
wide factors instead of overly precise single-event causal nodes.

Changes:

- Added `config/model/flexible_risk_factors.json`.
- Added `config/model/flow_engine_v0_9.json`.
- Added `config/examples/flow_scenario_global_tech_selloff.json`.
- Added `src/model/flow_engine.mjs`.
- Added `src/tools/sector_flow_review.mjs`.
- Added npm scripts:
  - `flow:review`
  - `flow:review:fixture`
- Added `docs/FLOW_ENGINE_V0_9.md`.
- Added Flow Engine tests.
- Bumped package version from `0.8.0` to `0.9.0`.

Important boundary:

- Flow Engine writes sector-flow review outputs only.
- It does not modify graph scores, collector enable flags, or portfolio
  actions.
- Single-company or single-headline events must be mapped into wide factors
  before they affect sector review scores.

## 0.8.0

Source package: local `0.7.9` build plus provider research direction from the
project discussion.

Changes:

- Added `providers/efinance_quote_bridge/probe_a_share_etf_quotes.py`.
- Added `providers/qstock_bridge/probe_a_share_structure.py`.
- Added `providers/provider_comparison/compare_a_share_etf_providers.py`.
- Added npm scripts:
  - `provider:efinance:probe`
  - `provider:efinance:probe:fixture`
  - `provider:qstock:probe`
  - `provider:qstock:probe:fixture`
  - `providers:compare:a-share-etf`
- Added `docs/PROVIDER_LAB_V0_8.md`.
- Added provider-lab tests.
- Bumped package version from `0.7.9` to `0.8.0`.

Important boundary:

- Provider Lab only writes probe and comparison reports.
- It does not enable real collector sources.
- It does not change graph-core scoring.
- It does not make buy/sell decisions.

## 0.7.9

Source package: local `0.7.8` build plus user terminal output from macOS.

Changes:

- Updated AKShare export validation to separate row-data validity from
  ETF-flow readiness.
- A first clean real run with one date and empty ETF-flow columns now validates
  as `status: ok` with `flow_readiness.status: baseline_only`.
- Added test coverage for the first-run baseline case.
- Bumped package version from `0.7.8` to `0.7.9`.

Important boundary:

- ETF-flow collector sources remain disabled.
- `baseline_only` is not a trading signal and not a model input.
- Core graph code is unchanged.

## 0.7.8

Source package: local `0.7.7` build.

Changes:

- Added `providers/akshare_etf_bridge/inspect_exports.py`.
- Added `npm run provider:akshare:inspect`.
- The inspector writes JSON and Markdown review reports under
  `model_outputs/provider_inspection/`.
- Added automated test coverage for the inspection report.
- Bumped package version from `0.7.7` to `0.7.8`.

Important boundary:

- The inspector is read-only against model configuration.
- It does not enable collector sources.
- It does not call AKShare.
- It does not modify graph-core code.

## 0.7.7

Source package: local `0.7.6` build plus user terminal output from macOS.

Changes:

- Repacked the project as a clean release package.
- Excluded build-time runtime outputs from the zip:
  `raw_data/`, `data/provider_exports/`, `model_outputs/`, `observations/`,
  `snapshots/`, and `reports/`.
- Kept AKShare bridge behavior unchanged from `0.7.6`.
- Bumped package version from `0.7.6` to `0.7.7`.

Reason:

- The user confirmed `0.7.6` real AKShare export succeeded.
- The `0.7.6` zip still contained fixture/test output dates, which made
  validation reports include sample dates that were not created by the user's
  real run.

## 0.7.6

Source package: local `0.7.5` build plus user terminal output from macOS.

Changes:

- Changed AKShare share/scale endpoints from hard requirements to optional
  enrichment sources.
- `fund_etf_spot_em` remains required; `fund_etf_scale_sse` and
  `fund_etf_scale_szse` failures are recorded as warnings and do not stop
  row-level quote export.
- Added raw payload and run-status warnings for optional endpoint failures.
- Added a fake-AKShare test that simulates `fund.szse.cn` SSL failure.
- Bumped package version from `0.7.5` to `0.7.6`.

Important boundary:

- This only changes the external provider bridge.
- Validation can still fail if ETF-flow columns are incomplete, so partial
  quote export is not silently treated as complete flow data.
- Provider-export collectors remain disabled by default.

## 0.7.5

Source package: local `0.7.4` build plus user terminal output from macOS.

Changes:

- Restored the missing `compact_date` helper used by the real AKShare export
  path.
- Added a fake-AKShare real-path test that simulates the AKShare 1.18.64
  `fund_etf_scale_sse` signature mismatch.
- Verified the bridge can export real-mode rows when `fund_etf_scale_sse`
  accepts no keyword arguments.
- Bumped package version from `0.7.4` to `0.7.5`.

Important boundary:

- The fix is limited to `providers/akshare_etf_bridge`.
- Core graph code is unchanged.
- Provider-export collectors remain disabled by default.

## 0.7.4

Source package: local `0.7.3` build plus user terminal output from macOS.

Changes:

- Fixed AKShare 1.18.64 compatibility for `fund_etf_scale_sse` when the
  endpoint does not accept a `symbol` keyword argument.
- Added endpoint-call fallback that retries an AKShare function without keyword
  arguments only when the error is an unexpected keyword argument.
- Updated real-run export to fill previous ETF share from existing CSV history
  when current AKShare output does not provide a previous-share field.
- Updated export validation to check the latest provider run-status file by
  default.
- Bumped package version from `0.7.3` to `0.7.4`.

Important boundary:

- Provider compatibility remains inside `providers/akshare_etf_bridge`.
- Core graph code is unchanged.
- Provider-export collectors remain disabled by default.

## 0.7.3

Source package: local `0.7.2` build.

Changes:

- Added `providers/akshare_etf_bridge/validate_exports.py`.
- Added `npm run provider:akshare:validate`.
- Added disabled local CSV source templates for all 11 A-share industry
  ETF-flow columns exported by the AKShare bridge.
- Updated AKShare bridge docs to describe export validation and real-run status.
- Added tests for provider export validation.
- Bumped package version from `0.7.2` to `0.7.3`.

Important boundary:

- AKShare was not installed in the build environment, and package installation
  was not available during this run. Real export remains pending.
- All provider-export collectors remain disabled by default.
- Daily scoring still uses the mock source unless a source is explicitly
  enabled in config.

## 0.7.2

Source package: local `0.7.1` build.

Changes:

- Added `providers/akshare_etf_bridge/` as the first external provider bridge
  for A-share industry ETF data.
- Added `providers/akshare_etf_bridge/provider_contract.json` to keep the
  representative ETF universe and output contract editable without touching
  bridge code.
- Added `providers/akshare_etf_bridge/export_a_share_etf_daily.py`.
- Added `npm run provider:akshare:fixture` for deterministic offline export.
- Added `npm run provider:akshare` for real AKShare export after dependency
  installation and source review.
- Added `docs/AKSHARE_ETF_BRIDGE.md`.
- Added a disabled local CSV source template for `brokerage_etf_flow` from
  `data/provider_exports/a_share_sector_flow.csv`.
- Added tests for the fixture bridge output.
- Bumped package version from `0.7.1` to `0.7.2`.

Important boundary:

- The bridge is outside `src/core`.
- Real provider output still does not enter scheduled scoring by default.
- Provider exports must be reviewed before enabling local CSV sources.

## 0.7.1

Source package: local `0.7.0` build.

Changes:

- Compared open-source provider candidates for A-share industry ETF ingestion:
  AKShare, efinance, TuShare, mootdx, and Qlib.
- Added `docs/OPEN_SOURCE_DATA_PROVIDER_COMPARISON.md`.
- Added `config/data_providers/open_source_candidates.json` as a structured
  provider decision record.
- Added tests proving provider candidates remain external adapter plans and are
  disabled by default.
- Bumped package version from `0.7.0` to `0.7.1`.

Important boundary:

- Provider packages remain outside `src/core`.
- The next real-data step should be a provider bridge that writes local CSV or
  JSON exports for existing collectors.
- No provider should directly set final pool scores or dashboard values.

## 0.7.0

Source package: local `0.6.3` build.

Changes:

- Added `src/collectors/local_csv_collector.mjs` for project-local CSV data.
- Added `src/collectors/http_json_collector.mjs` for simple JSON API sources.
- Added `src/tools/source_status_report.mjs`.
- Added `npm run sources:status`.
- Added more disabled hard-data source examples for FRED and Binance-style JSON.
- Added `btc_price_momentum` node and a market-confirmation edge into the BTC
  pool.
- Added `docs/DATA_INGESTION_V0_7.md`.
- Added tests for local CSV ingestion, HTTP JSON path extraction, JSON
  normalization, and source status reporting.
- Updated raw-data writes to use the same atomic-write helper as snapshots,
  reports, dashboard exports, and model outputs.

Important boundary:

- Real data sources remain disabled by default.
- v0.7.0 adds ingestion infrastructure; it does not claim production-grade
  source reliability yet.

## 0.6.3

Source package: local `0.6.2` build.

Changes:

- Added `docs/MODULE_STATUS.md` to record the current status of core model,
  hard-data collectors, news collectors, pipeline, scheduler, frontend,
  reporting, regime engine, and change logging.
- Clarified which modules are working, which are skeletons, which are configured
  placeholders, and which are planned.
- Added the change-log rule: every meaningful package or architecture update
  must update `docs/CHANGELOG.md`; recovery-relevant changes should also update
  `PROJECT_STATE.md` or `docs/PROJECT_MEMORY.md`.

## 0.6.2

Source package: local `0.6.1` build.

Changes:

- Added `config/sector_catalog/a_share_industry_etfs.json` as the source catalog
  for A-share industry ETF pools.
- Added `src/tools/materialize_sector_catalog.mjs`.
- Added `npm run materialize:sectors`.
- Materialized 11 A-share industry pools:
  `brokerage`, `bank_insurance`, `semiconductor`, `ai_computer`,
  `communication_electronics`, `new_energy_ev`, `healthcare_pharma`,
  `consumer`, `defense_military`, `resources_materials`,
  `real_estate_infra`.
- Materialized demo ETF assets and sector template nodes for each sector.
- Added differentiated mock observations for the sector template nodes so the
  offline demo shows industry rotation behavior before real data is connected.
- Added atomic file writes for observations, snapshots, reports, model outputs,
  and dashboard export to avoid reading partially written JSON during concurrent
  tests or scheduled runs.
- Updated tests so sector expansion is verified from the catalog, not from
  hardcoded expectations.

## 0.6.1

Source package: local `0.6.0` build.

Changes:

- Added A-share market-water-level nodes.
- Added A-share semiconductor sector confirmation and fundamental nodes.
- Added `sp500` pool and `sp500_etf_demo` asset.
- Added S&P 500 ETF flow, breadth, earnings, valuation, buyback, mega-cap, and
  policy/news nodes.
- Added `docs/ETF_FLOW_MODEL.md`.
- Moved default report entity selection into
  `config/reporting/default_entities.json`.
- Added tests for S&P 500 child-pool discovery, S&P 500 ETF inheritance, and
  configured report entities.

## 0.6.0

Source package: `financial-pond-framework-v0.5.1-recovery(1).zip`

Changes:

- Added `docs/PROJECT_MEMORY.md` as the main recovery document.
- Added `docs/ROADMAP.md` for future work and version direction.
- Added this changelog.
- Added `config/model/regime_rules.json`.
- Added `src/model/regime_engine.mjs`.
- Added `src/storage/model_output_store.mjs`.
- Updated `src/pipeline/run_cycle.mjs` to evaluate regimes and write
  `model_outputs/<date>/regime_summary.json`.
- Added `config/news/search_queries.json`.
- Added `src/collectors/news_search_collector.mjs`.
- Updated collector factory so enabled news search queries become an optional
  collector.
- Added tests for regime evaluation and news search mapping.
- Bumped package version from `0.5.1` to `0.6.0`.


Important boundary:

- Regime summaries are read-only model context in this version. They do not
  mutate graph scores.
- News search outputs node observations only. It does not directly alter pond
  scores.

## v0.10.0 - Independent news intelligence and readable Financial Ponds UI

- Added independent news intelligence module:
  - `config/news/news_daily_v1.json`
  - `src/news/news_intelligence.mjs`
  - `src/tools/news_daily_review.mjs`
- Added scripts:
  - `npm run news:review`
  - `npm run news:review:fixture`
  - `npm run news:review:ci`
- News outputs are written separately from hard-data outputs:
  - `observations/<date>/news_observations.json`
  - `model_outputs/<date>/news_review.json`
  - `model_outputs/<date>/news_review.md`
- Sector Flow Review can read news observations, but the core graph scores remain unchanged.
- CI daily runner now collects the news layer before Flow Review.
- Frontend now prioritizes readable A-share sector ranking, news pressure, and data boundaries instead of the low-level graph view.
- Boundary remains: news is expectation pressure; hard data confirms or rejects it.
