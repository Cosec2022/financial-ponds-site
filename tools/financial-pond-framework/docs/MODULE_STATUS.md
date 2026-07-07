# Module Status

This document records the current implementation state. It is meant for recovery
from a zip package and for avoiding confusion between working modules,
skeletons, and planned production adapters.

## Status Levels

- `working`: runs offline or with configured inputs and is covered by tests.
- `skeleton`: code path exists, but real source quality and production behavior
  are not yet verified.
- `configured placeholder`: config and interfaces exist, but the data source is
  disabled or not connected yet.
- `planned`: documented as future work.

## Core Model

Status: `working`

Files:

- `src/core/graph_engine.mjs`
- `src/core/scoring_engine.mjs`
- `src/core/registry.mjs`
- `src/core/schema.mjs`
- `config/edges/graph.json`
- `config/scoring/v0_1.json`

Current capability:

- Loads config-driven nodes, pools, assets, portfolios, and edges.
- Scores entities through incoming configured edges.
- Keeps market-specific financial meaning out of core code.
- Validated by config, scoring, and invariant tests.

Not yet complete:

- No nonlinear overheating rules.
- No backtest or historical parameter comparison.
- No final allocation engine.

## A-share Industry ETF Layer

Status: `working`

Files:

- `config/sector_catalog/a_share_industry_etfs.json`
- `src/tools/materialize_sector_catalog.mjs`
- `config/pools/a_share_*.json`
- `config/assets/a_share_*_etf_demo.json`
- `docs/ETF_FLOW_MODEL.md`

Current capability:

- 31 A-share industry ETF pools are generated from a catalog.
- 11 sectors are reviewed provider-mapped representative ETF pools.
- 20 sectors are framework-only slots until their provider mappings are reviewed.
- Each sector has flow, policy news, relative strength, breadth, leader
  confirmation, and fundamental proxy nodes.
- The sector catalog can be edited and regenerated with:

```bash
npm run materialize:sectors
```

Not yet complete:

- Real ETF share, AUM, turnover, and sector data are not connected.
- Sector-specific fundamental data sources are placeholders.

## A-share Sector Flow Review

Status: `working`

Files:

- `src/model/flow_engine.mjs`
- `src/tools/sector_flow_review.mjs`
- `src/tools/akshare_flow_observations.mjs`
- `config/model/flow_engine_v0_9.json`
- `config/model/flexible_risk_factors.json`
- `config/examples/flow_scenario_global_tech_selloff.json`
- `docs/FLOW_ENGINE_V0_9.md`
- `docs/FLOW_ENGINE_V0_9_1_AKSHARE_INPUTS.md`

Current capability:

- Reads the A-share sector catalog and automatically reviews all configured
  sector ETF pools.
- Combines direct-flow proxies, market confirmation, market liquidity, policy
  sentiment, fundamental proxies, and wide external factor effects.
- Publishes `data_availability` so the frontend and rotation layer can tell
  `etf_flow_ready`, `partial_etf_flow`, `price_volume_only`, and `thin_data`
  days apart.
- Supports fixture review through:

```bash
npm run flow:review:fixture
```

- Supports dated review after observations exist:

```bash
npm run cycle 2026-07-03
npm run flow:review -- --as-of 2026-07-03
```

- Supports AKShare provider-derived review inputs:

```bash
npm run provider:akshare
npm run provider:akshare:to-flow
npm run flow:review -- --as-of 2026-07-02
```

Important boundary:

- This module writes `model_outputs/<date>/sector_flow_review.json` and
  `model_outputs/<date>/sector_flow_review.md`.
- The AKShare input bridge writes
  `observations/<date>/provider_flow_observations.json`.
- It does not change graph scores or portfolio actions.
- It does not create precise causal edges from one overseas stock or headline
  to one A-share ETF.
- Missing `estimated_flow` is not filled with a proxy flow value.

Not yet complete:

- No real multi-day ETF share-change history is connected yet.
- Component weights are first-pass parameters and need historical testing.
- No final allocation or risk-sizing layer is connected.

## A-share Sector Rotation History

Status: `working`

Files:

- `src/tools/sector_rotation_history.mjs`
- `financial-pond/data/sector_rotation_history.json`
- `tests/sector_rotation_history.test.mjs`

Current capability:

- Stores daily rotation snapshots for leaders, laggards, clusters, evidence,
  confidence, and data completeness.
- Compares the latest day with the prior stored day.
- Publishes `trend_confirmations` for persistent leaders, persistent laggards,
  strengthening sectors, weakening sectors, and leading/lagging clusters.
- Requires at least 3 trading-day samples before `trend_confirmed` can appear.

Important boundary:

- Trend confirmation confirms repeated model output, not a buy/sell signal.
- If the GitHub Action does not persist published JSON, history cannot
  accumulate.

## Hard Data Collection

Status: `skeleton`

Files:

- `src/collectors/http_csv_collector.mjs`
- `src/collectors/mock/mock_observation_collector.mjs`
- `config/collectors/hard_data_sources.json`
- `config/mock_scores/2026-07-02.json`
- `config/data_providers/open_source_candidates.json`
- `docs/OPEN_SOURCE_DATA_PROVIDER_COMPARISON.md`
- `providers/akshare_etf_bridge/`
- `docs/AKSHARE_ETF_BRIDGE.md`

Current capability:

- Mock collector is enabled and keeps the system runnable offline.
- HTTP CSV collector can fetch enabled CSV sources and normalize them.
- HTTP JSON collector can fetch enabled JSON sources and extract numeric values
  by dot path.
- Local CSV collector can read project-local CSV exports from paths such as
  `data/manual/a_share_sector_flow.csv`.
- FRED real-rate and VIX CSV examples are configured but disabled.
- `npm run sources:status` writes a source status report.
- Open-source provider candidates have been compared. `akshare` is the primary
  A-share ETF provider candidate, `efinance` is the quote fallback, `tushare` is
  optional when a token is available, and `mootdx` is a low-priority quote
  fallback.
- AKShare bridge fixture mode can export local CSV/JSON files for A-share ETF
  flow testing without network access.
- AKShare bridge export validation can check row-level CSV, sector-flow CSV,
  representative ETF codes, required columns, and historical date count.
- All 11 A-share sector ETF-flow provider-export sources are present as disabled
  `local_csv` templates.
- AKShare bridge now tolerates the AKShare 1.18.64 `fund_etf_scale_sse`
  signature that does not accept a `symbol` keyword.
- Export validation checks the latest provider run-status file by default.
- v0.7.5 restores the missing `compact_date` helper and adds fake-AKShare
  real-path test coverage.
- v0.7.6 records SSE/SZSE share-scale endpoint failures as warnings so spot
  quote export can continue.
- v0.7.7 is a clean release package. It excludes build-time runtime outputs, so
  provider validation starts from files generated on the user's machine.
- v0.7.8 adds a read-only AKShare export inspector and Markdown/JSON inspection
  reports for source review.
- v0.7.9 separates row-data validation from ETF-flow readiness. First clean
  real runs can validate as `baseline_only` instead of failing.
- v0.8.0 adds Provider Lab probes for efinance and qstock plus a three-provider
  A-share ETF comparison report.
- v0.9.0 adds Flow Engine review outputs for A-share industry ETF pools.
- v0.9.1 adds AKShare provider export to Flow Engine observation mapping.
- v0.9.2 fixes the macOS Flow Engine isolation test without changing model
  behavior.
- v0.9.3 adds provider quote-quality gates so empty backup-provider rows do not
  raise cross-source confidence.
- v0.9.4 makes efinance real probing conservative and keeps `npm test` away from
  live efinance endpoint behavior.

Not yet complete:

- A-share real data adapters are not connected.
- S&P 500 ETF flow adapter is not connected.
- Binance, WGC, HKEX, FRED full macro set, and A-share ETF data adapters are
  planned but not built.
- No retry, rate-limit, credential, or source-health layer yet.
- AKShare real mode is not scheduled or enabled by default.
- Provider-export local CSV sources are disabled until output is reviewed.
- Real AKShare export succeeded once on the user's local macOS environment with
  v0.7.6. The next step is reviewing the real exported values before enabling
  provider-export local CSV sources.
- The user's clean v0.7.8 run produced valid row-level quotes and latest shares,
  but no estimated ETF flows because no previous local share baseline existed.
- efinance and qstock probes are new in v0.8.0 and are not scheduled or enabled
  as model inputs.

## News Collection

Status: `skeleton`

Files:

- `src/collectors/rss_news_collector.mjs`
- `src/collectors/news_search_collector.mjs`
- `config/news/rss_sources.json`
- `config/news/search_queries.json`
- `config/news/news_rules.json`
- `config/news/news_event_schema.json`

Current capability:

- RSS collector exists and converts matching news items into node observations.
- Search-RSS collector exists with query config and deduplication.
- Rule-based keyword mapping exists for geopolitics, semiconductors, China
  policy, Fed policy, and AI capex.
- All real RSS and search queries are disabled by default.

Not yet complete:

- No production source list is verified.
- No AI semantic classifier is connected.
- No robust cross-source event store yet.
- No historical news-impact backtest.
- No market-confirmation feedback loop for news events.

## Pipeline

Status: `working`

Files:

- `src/pipeline/run_daily.mjs`
- `src/pipeline/run_cycle.mjs`
- `src/pipeline/collector_factory.mjs`

Current capability:

- Runs collectors.
- Validates observations.
- Scores graph.
- Writes observations, snapshots, reports, dashboard data, and regime summaries.
- Uses atomic writes for JSON/report outputs.

Important command:

```bash
npm run cycle 2026-07-03
```

## Scheduler

Status: `working skeleton`

Files:

- `src/scheduler/run_twice_daily.mjs`
- `config/schedules/twice_daily.json`

Current capability:

- Long-running Node process checks every 30 seconds.
- Runs one cycle at configured morning and evening times.
- Tracks state in `scheduler_state/twice_daily_state.json`.

Default schedule:

```text
08:30 and 20:30 Asia/Hong_Kong
```

Not yet complete:

- Not integrated with system cron, launchd, pm2, Docker, or cloud hosting.
- State writes are simple JSON and not designed for multi-process schedulers.

## Frontend

Status: `working basic dashboard`

Files:

- `web/index.html`
- `web/app.js`
- `web/styles.css`
- `src/web/export_dashboard_data.mjs`
- `src/web/serve_static.mjs`
- `web/data/dashboard.json`

Current capability:

- Static dashboard reads exported `web/data/dashboard.json`.
- Local web server works through:

```bash
npm run web
```

Not yet complete:

- UI is not final.
- No production deployment config.
- No interactive source enable or disable controls.
- No upload workflow for user holdings yet.

## ETF Decision Readiness

Status: `working prototype`

Files:

- `src/tools/etf_decision_readiness.mjs`
- `model_outputs/<date>/etf_decision_readiness.json`
- `model_outputs/<date>/etf_decision_readiness.md`
- `financial-pond/data/etf_decision_readiness.json`
- `tests/etf_decision_readiness.test.mjs`

Current capability:

- Converts sector-module and sector-flow output into ETF action-readiness labels.
- Blocks buy-oriented labels when the provider run is missing, data is mock-only,
  AKShare output is `baseline_only`, observed ETF-flow coverage is too low, or
  rotation history has fewer than 3 samples.
- Separates `wait_for_real_flow`, `watch_for_persistence`,
  `confirmation_candidate`, and `small_position_candidate`.
- Publishes blockers and next steps so the frontend can explain why an ETF is
  not actionable yet.
- Keeps blocked representative sectors visible as pending watch items when no
  actionable ETF candidate exists yet.
- Publishes user-facing Chinese readings for global blockers.
- Runs with:

```bash
npm run etf:readiness -- --as-of YYYY-MM-DD
```

Important boundary:

- This module is a gatekeeper, not an allocation engine.
- It does not create buy/sell orders.
- It does not fake missing `estimated_flow`.

Not yet complete:

- No provider-backed PE/PB/dividend/ROE valuation source.
- No user-specific position sizing, cash limits, or risk budget.
- No backtested thresholds.

## Reporting

Status: `working`

Files:

- `src/reporting/markdown_report_generator.mjs`
- `config/reporting/default_entities.json`
- `reports/<date>/daily_report.md`

Current capability:

- Generates human-readable Markdown report.
- Report entities are config-driven.
- Shows top contributors per entity.

Not yet complete:

- No natural-language AI report writer connected.
- No ranking, portfolio attribution, or action checklist yet.

## Regime Engine

Status: `working skeleton`

Files:

- `src/model/regime_engine.mjs`
- `config/model/regime_rules.json`
- `model_outputs/<date>/regime_summary.json`

Current capability:

- Evaluates configured market-regime rules from observations.
- Writes a regime summary during `npm run cycle`.

Important boundary:

- Regime output is read-only model context in this version.
- It does not mutate graph scores.

## Change Logging

Status: `working process`

Files:

- `docs/CHANGELOG.md`
- `PROJECT_STATE.md`
- `docs/PROJECT_MEMORY.md`

Rule:

- Every package or meaningful architecture update must add a `docs/CHANGELOG.md`
  entry.
- Recovery-relevant changes must also update `PROJECT_STATE.md` or
  `docs/PROJECT_MEMORY.md`.
