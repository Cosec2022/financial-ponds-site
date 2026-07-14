# Changelog

## v0.10.69

- Added FP-HIST-MKT-01 replayable normalized historical market-input snapshots.
- Added bounded AKShare Eastmoney/Sina ETF history normalization, offline replay, and split OHLCV versus flow coverage diagnostics.

## v0.10.68 - Deterministic daily CI boundary

- Fixed historical daily replays so outcome-review status is evaluated at the
  published `AS_OF` knowledge frontier rather than the machine wall clock.
- Split daily data generation from site/Worker assembly (`build:data` and
  `build:site`) so the CI daily workflow does not regenerate persistence data.
- Fixed immutable longitudinal snapshot identity to ignore execution-only
  `generated_at` changes; a real business-payload change still creates exactly
  one revision.
- Added one workflow time context (`AS_OF`, `GENERATED_AT`, `REVIEW_NOW`) and
  separated CI build, artifact validation, published-data validation, and tests.

## v0.10.66 - Market Penetration Brief MVP

- Quarantined RSS/search narratives from graph scoring; they remain display-only.
- Added a versioned daily Market Penetration Brief, source registry, deterministic
  market observations, media-narrative grouping, and explicit hypotheses.
- Verified facts remain empty until a primary-source verification adapter exists.

## v0.10.65 - Trading-session reviews and explicit benchmark proxy

- Bumped site and framework package versions to `0.10.65`.
- Replaced calendar-day T+N scheduling with a versioned explicit A-share
  trading-session calendar and fail-closed `calendar_unknown` behavior.
- Split outcome state into `review_status` and `review_reason`, covering
  pending market-open/EOD states, stale data, missing candidate or benchmark
  prices, unknown calendar coverage, and invalid baselines.
- Enforced exact-date candidate and benchmark prices for delayed reruns and
  removed the benchmark-review-close baseline fallback.
- Configured `510300` as an operational broad-market ETF proxy, not as the
  complete A-share market.
- Added an independent, bounded-retry exact-date benchmark collector that
  preserves last-known-good archives on provider failure.
- The dashboard displays the benchmark disclosure and all eight review reasons.

Important boundary:

- The trading calendar covers `2026-07-01` through `2026-08-31`; out-of-range
  reviews fail closed. Calendar-expiry alerting remains a documented follow-up.
- Provider failures never authorize manual benchmark price entry.

## v0.10.64 - Due review unavailability diagnostics

- Bumped site and framework package versions to `0.10.64`.
- Added unavailable reason breakdowns to due review verification, outcome
  reporting, review analytics, and the dashboard line.
- Due T+1/T+3 rows now persist symbol, expected review price date, latest
  available price date, benchmark diagnostics, unavailable reason, and a short
  diagnostic note.
- Outcome review logic now separates market-not-closed, stale provider data,
  missing candidate price, missing benchmark price, and invalid baselines.
- Re-runs can move the same due row from unavailable to reviewed once real
  candidate and benchmark prices are available, without duplicating rows.

Important boundary:

- Unavailable and pending rows are not counted as wins or losses.
- Future outcomes remain pending and are not fabricated.

## v0.10.63 - Explicit due review verification

- Bumped site and framework package versions to `0.10.63`.
- Added `candidate_due_review_verification.json`.
- T+1/T+3 review rows now explicitly record whether they are due, whether
  required market data exists, whether review completed, and why unavailable
  rows were not reviewed.
- Candidate review history now persists review due date, reviewed data date,
  baseline price, review price, absolute return, benchmark return, excess
  return, and unavailable reason when applicable.
- Review analytics now separates reviewed, pending, unavailable, and
  insufficient-sample rows.

Important boundary:

- Due rows with missing prices become explicit unavailable rows.
- Unavailable rows are not counted as wins or losses.
- Future outcomes remain pending and are not fabricated.

## v0.10.62 - Candidate state review analytics

- Bumped site and framework package versions to `0.10.62`.
- Added `candidate_review_analytics.json`.
- Review analytics summarize available T+1/T+3 reviewed outcomes by:
  candidate state, risk gate, overheat score bucket, and major-wave score
  bucket.
- Metrics include reviewed count, absolute and benchmark-relative win rates,
  average return, average excess return, pulse failure count, overheated
  failure rate, and continuation rates.

Important boundary:

- Pending, unavailable, and insufficient-data reviews are excluded from rates.
- Small samples are marked `insufficient_sample`.
- No missing or future outcomes are fabricated.

## v0.10.61 - Right-side major-wave model artifacts

- Bumped site and framework package versions to `0.10.61`.
- Added a formal candidate state model artifact for observation candidates.
- Candidate rows now separate early right-side opportunity, major wave
  candidate, overheated strength, and risk-gated candidates.
- Persisted `candidate_state`, `overheat_score`, `major_wave_score`, and
  `risk_gate_status` through candidate outputs, price basis, outcome reviews,
  and review history.
- Added `candidate_state_model.json` and `candidate_review_history.json`.

Important boundary:

- Candidate state uses only candidate-date and prior observation artifacts.
- Future outcomes are not used to classify current candidates.
- The model remains `observe_only` and does not produce execution advice.

## v0.10.48 - Observation data backbone and workbench

- Bumped site and framework package versions to `0.10.48`.
- Added `src/core/observation_schema.mjs` with generic universe, pool, signal,
  vector forecast, manual review, outcome label, review horizon, and boundary
  contracts.
- Added `npm run data:vault`.
- Added `npm run observation:snapshot`.
- Added daily vault outputs with file lists, missing-file lists, hashes,
  available modules, missing modules, and data-reality summary.
- Added observation snapshots with all signal slots present for every pool:
  flow, price momentum, liquidity, rotation, news, valuation, fundamental, and
  risk.
- Added append-only `observation_history.jsonl`.
- Published `observation_snapshot.json`, `manual_review_log.json`,
  `outcome_labels.json`, and `daily_data_vault.json`.
- Added pending T+1, T+3, T+5, and T+20 outcome checks.
- Added the homepage `观察工作台` with 今日观察, 信号矩阵, 资金矢量, and
  复盘记录 tabs.
- Updated the daily runner, CI runner, build assets, published-data validation,
  Worker tests, workflow tests, framework tests, and summary command.

Important boundary:

- v0.10.48 preserves observation data so future review can happen.
- It improves cross-module workbench visibility.
- A-share is the first sample universe, not a core model assumption.
- ETF execution advice remains blocked.

## v0.10.47 - Index explainability and score breakdown

- Bumped site and framework package versions to `0.10.47`.
- Added a formula registry in `src/core/formula_registry.mjs`.
- Added `npm run index:explain`.
- Added `index_explainability.json` and `.md` outputs.
- The explainability layer documents displayed indexes with:
  - source files and source fields;
  - raw inputs;
  - formulas in human and machine-readable form;
  - component contributions;
  - calculation steps;
  - data reality flags;
  - caveats and execution boundary.
- Published `financial-pond/data/index_explainability.json`.
- Added the homepage `指数详情解释` panel with search/selectable index details.
- Updated the daily runner, CI runner, build assets, published-data validation,
  Worker tests, workflow tests, framework tests, and summary command.

Important boundary:

- v0.10.47 explains where displayed numbers come from.
- It does not invent formulas; missing formula registry entries are reported as
  `formula_registry_missing`.
- ETF execution advice remains blocked.

## v0.10.46 - Decision gate ledger

- Bumped site and framework package versions to `0.10.46`.
- Added `npm run decision:gates`.
- Added `decision_gate_ledger.json` and `.md` outputs.
- The ledger explains readiness gates across:
  - provider run and provider history;
  - estimated-flow and true-flow coverage;
  - attribution conflicts;
  - watchlist conflict review;
  - confirmed watch availability;
  - valuation/fundamental source reality;
  - rotation visibility;
  - pool graph snapshot availability;
  - data reality audit;
  - execution-language safety.
- Published `financial-pond/data/decision_gate_ledger.json`.
- Added the homepage `决策闸门账本` panel.
- Updated the daily runner, CI runner, build assets, published-data validation,
  Worker tests, workflow tests, and summary command.

Important boundary:

- Provider flow readiness does not equal execution readiness.
- v0.10.46 improves readiness explanation and cross-module gate visibility.
- ETF execution advice remains blocked while valuation/fundamental, data
  reality, conflict, or execution-language gates are not cleared.

## v0.10.45 - Watchlist state machine

- Bumped site and framework package versions to `0.10.45`.
- Added `npm run watchlist:state`.
- Added `sector_watchlist_state.json` and `.md` outputs.
- Converts cross-module attribution into daily watchlist states:
  - `confirmed_watch`;
  - `conflict_review`;
  - `flow_only_candidate`;
  - `rotation_only_candidate`;
  - `deteriorating_watch`;
  - `avoid_watch`;
  - `blocked_execution`.
- Added state-change labels, evidence summaries, upgrade/downgrade conditions,
  and execution boundaries.
- Published `financial-pond/data/sector_watchlist_state.json`.
- Added the homepage `观察清单状态` panel.
- Updated the daily runner, CI runner, build assets, published-data validation,
  Worker tests, workflow tests, and summary command.

Important boundary:

- This converts attribution into a review workflow.
- It does not unlock ETF execution advice.
- It does not output buy/sell/position wording.

## v0.10.44 - Signal attribution and conflict visibility

- Bumped site and framework package versions to `0.10.44`.
- Added `npm run signal:attribution`.
- Added `sector_signal_attribution.json` and `.md` outputs for cross-module
  signal attribution.
- The attribution layer combines:
  - ETF estimated flow and amount ranks;
  - daily sector tiers;
  - rotation labels and streaks;
  - module labels;
  - optional graph snapshot scores.
- Added conflict detection when:
  - ETF flow rank #1 differs from the daily conclusion leader;
  - ETF estimated flow is positive while the daily tier is weak;
  - rotation is strong while ETF estimated flow is zero, missing, or negative.
- Published `financial-pond/data/sector_signal_attribution.json`.
- Added the homepage `行业信号归因` panel.
- Updated the daily runner, build assets, published-data validation, Worker
  tests, and summary command.

Important boundary:

- This improves explainability and cross-module conflict visibility.
- It does not unlock ETF execution advice.
- Attribution rows use observation/review labels only and do not output
  buy/sell/position wording.

## v0.10.42 - Confirmed leader score preservation

- Bumped site and framework package versions to `0.10.42`.
- Daily Sector Analysis now preserves the source row score for tiering and
  display.
- Persistent rotation leaders no longer disappear just because the current
  real-provider baseline flow score is compressed below the old absolute
  threshold.
- Added `current_flow_score` to Daily Sector Analysis rows so the compressed
  flow score remains visible for diagnostics.
- Added a regression test for the `trend_confirmed` + low current-flow-score
  case.

Important boundary:

- This restores watchlist readability; it does not relax ETF readiness gates.
- `baseline_only` still blocks ETF execution language.

## v0.10.41 - Visible rotation labels

- Bumped site and framework package versions to `0.10.41`.
- Added visible rotation chips to the homepage Daily Sector Analysis rows.
- The chips surface `rotation_diagnostic.label` directly instead of leaving it
  only inside the reading sentence.
- Positive states include leader continuation, weak-to-strong reversal, new
  leader, and marginal strengthening.
- Negative states include laggard continuation, strong-to-weak reversal, new
  laggard, and marginal weakening.

Important boundary:

- This is a UI/readability change.
- It does not change model scores, ETF gates, or trading boundaries.

## v0.10.40 - Rotation continuation labels

- Bumped site and framework package versions to `0.10.40`.
- Added `rotation_diagnostic` to each Daily Sector Analysis tier row.
- The diagnostic labels rotation state as:
  - `leader_continuation`;
  - `laggard_continuation`;
  - `leader_persistence_watch`;
  - `laggard_persistence_watch`;
  - `laggard_to_leader_reversal`;
  - `leader_to_laggard_reversal`;
  - `new_leader_watch`;
  - `new_laggard_watch`;
  - `strengthening_watch`;
  - `weakening_watch`;
  - `single_day_watch`.
- Daily Sector Analysis readings now include the rotation label before the ETF
  readiness boundary.
- Added tests to keep priority-watch and avoid-watch rows carrying continuation
  diagnostics.

Important boundary:

- This improves interpretability of existing sector history.
- It does not change ETF readiness gates or create buy/sell/allocation
  instructions.

## v0.10.39 - Module maturity audit

- Bumped site and framework package versions to `0.10.39`.
- Added `npm run project:maturity`.
- Added `FP-MAINT-02` style output:
  - `model_outputs/<date>/module_maturity_audit.json`
  - `model_outputs/<date>/module_maturity_audit.md`
- Published `financial-pond/data/module_maturity_audit.json`.
- Added a homepage `模块完成度` panel showing:
  - recommended mainline;
  - average module progress;
  - decision-path progress;
  - low-maturity module count;
  - priority modules;
  - low-maturity modules.
- Added tests for the audit parser, output writer, workflow publish path, asset embedding, data validation, and Worker JSON serving.

Important boundary:

- This is a project/module readiness audit, not market analysis.
- It does not alter sector scores or ETF readiness gates.
- ETF execution language still depends on observed ETF share-change flow and
  readiness gates.

## v0.10.38 - Provider history audit command

- Bumped site and framework package versions to `0.10.38`.
- Added `npm run provider:akshare:history`.
- The command writes:
  - `model_outputs/provider_history/akshare_provider_history.json`
  - `model_outputs/provider_history/akshare_provider_history.md`
- The audit reports provider CSV dates, previous available date, row counts,
  missing representative codes, `previous_share` rows, and `estimated_flow` rows.
- Added tests for:
  - single-date `baseline_only`;
  - two-date `flow_gate_ready`.

Important boundary:

- This command is read-only against scoring config.
- It does not run providers and does not create market signals.
- It is an operational check for whether the provider history chain can unlock
  share-change flow.

## v0.10.37 - Provider CSV history persistence

- Bumped site and framework package versions to `0.10.37`.
- Updated the daily GitHub Action so it persists the AKShare provider CSV history:
  - `tools/financial-pond-framework/data/provider_exports/*.csv`
  - AKShare provider run status JSON;
  - provider validation report;
  - provider inspection report.
- Added workflow regression checks so future changes do not silently drop provider CSV persistence.

Important boundary:

- This does not change scores or trading language.
- It preserves the historical baseline required for future `previous_share`,
  `share_change`, and `estimated_flow` calculation.
- Raw provider payloads are not added to the daily commit path.

## v0.10.36 - Provider history diagnostics

- Bumped site and framework package versions to `0.10.36`.
- Added `provider_history` to `akshare_provider_flow_observations.json`.
- The provider history records:
  - `available_dates`;
  - `current_date`;
  - `previous_available_date`;
  - row counts by date.
- Carried the provider history into `etf_decision_readiness.gates.share_change_diagnostics`.
- Updated ETF readiness and daily decision-gap readings so `baseline_only` explains whether the CSV truly has only one provider date or whether a previous date exists but `previous_share` was not backfilled.
- Added regression coverage for baseline-only provider exports with a single real provider date.

Important boundary:

- This does not synthesize historical ETF share flow.
- It does not unlock ETF execution advice.
- It only makes the remaining provider-history blocker auditable.

## v0.10.35 - Daily decision ticket

- Bumped site and framework package versions to `0.10.35`.
- Extended `FP-DAILY-01` with `decision_ticket`.
- The ticket turns priority watch, confirm next, and avoid watch rows into:
  - current state;
  - upgrade conditions;
  - failure conditions;
  - human-review boundary.
- The homepage now renders a `明日决策票` card inside `今日行业结论`.
- Published-data validation now requires the `decision_ticket` contract.

Important boundary:

- This is not a buy, sell, rebalance, or allocation instruction.
- The ticket can upgrade a sector only to human review.
- ETF execution language remains blocked until readiness gates pass.

## v0.10.34 - Share-change flow diagnostics

- Bumped site and framework package versions to `0.10.34`.
- Added `share_change_diagnostics` to `akshare_provider_flow_observations.json`.
- Carried the diagnostics into `etf_decision_readiness.gates.share_change_diagnostics`.
- The ETF readiness page now shows how many representative ETFs can calculate share-change flow and which rows still miss fields.
- Daily decision-gap readings now use the share-change diagnostics instead of a generic waiting message.
- Published-data validation now requires the ETF share-change diagnostics contract.

Important boundary:

- This does not synthesize ETF share-change flow.
- `flow_ready` still requires real estimated-flow rows from provider data.
- No output is a buy, sell, rebalance, or allocation instruction.

## v0.10.33 - Daily decision gap

- Bumped site and framework package versions to `0.10.33`.
- Extended `FP-DAILY-01` with `decision_gap.checks`.
- The homepage now shows passed, pending, and blocked ETF decision gates inside `今日行业结论`.
- Daily sector names now normalize to the Chinese sector registry before rendering.
- Daily sample count now uses recovered rotation-history samples when they are ahead of ETF readiness gates.
- `validate:data` now requires the daily decision-gap contract.

Important boundary:

- This does not unlock ETF execution advice.
- `priority_watch` remains observation-only until ETF readiness gates pass.
- No output is a buy, sell, rebalance, or allocation instruction.

## v0.10.32 - Rotation history recovery guard

- Bumped site and framework package versions to `0.10.32`.
- Hardened `FP-HIST-01` against history-chain loss:
  - GitHub Actions checkout now uses `fetch-depth: 30`.
  - `sector_rotation_history` can read recent committed versions of `financial-pond/data/sector_rotation_history.json`.
  - History arrays are merged by `as_of` before trend confirmation.
  - The output records `history_recovery` metadata.
- Added a regression test for recovering a missing middle history day.
- Updated workflow tests to require checkout history depth.

Important boundary:

- This does not create artificial market samples.
- It only recovers rotation snapshots already present in recent Git history.
- It does not change sector scores, provider endpoints, ETF readiness gates, or trading language.

## v0.10.31 - Daily sector analysis panel

- Bumped site and framework package versions to `0.10.31`.
- Added `FP-DAILY-01` daily sector analysis:
  - `src/tools/daily_sector_analysis.mjs`
  - `npm run daily:sector-analysis`
  - `financial-pond/data/daily_sector_analysis.json`
- The analysis combines sector flow, rotation history, sector module review, and ETF readiness into:
  - priority watch
  - confirm next
  - avoid watch
- Added the homepage `今日行业结论` panel.
- Updated GitHub Actions, asset embedding, and published-data validation so `daily_sector_analysis.json` is required.
- Added framework and Worker tests for the new contract.

Important boundary:

- This is an observation layer only.
- If `etf_decision_readiness.guidance_state` is `not_ready`, strong sectors remain watch-only.
- No output is a buy, sell, rebalance, or allocation instruction.

## v0.10.30 - Published data completeness guard

- Bumped site and framework package versions to `0.10.30`.
- Added `scripts/validate-published-data.mjs`.
- Added `npm run validate:data`.
- Updated the daily GitHub Action to run `npm run validate:data` before Worker build.
- Strengthened workflow tests so daily publish must include:
  - `sector_module_review.json`;
  - `etf_decision_readiness.json`;
  - `data_reality_audit.json`;
  - the rest of the web JSON contract.

Boundary:

- This update does not change scoring weights.
- This update does not change provider endpoints.
- It prevents silent partial publishes after the daily Action.

## v0.10.29 - Provider status panel

- Bumped site and framework package versions to `0.10.29`.
- Added a first-screen Provider Status panel that reads existing audit/readiness JSON:
  - AKShare doctor status;
  - AKShare real provider run status;
  - ETF share-flow coverage;
  - rotation sample count;
  - valuation/fundamental source state;
  - the next command to run.
- Added frontend styling for provider status and command cards.
- Added Worker tests to guard the new provider panel and provider audit layers.

Boundary:

- This update does not change scoring weights.
- This update does not change provider endpoints or collection logic.
- The next-command card is operational guidance only.
- Current packaged ETF guidance remains blocked until real provider and flow gates unlock.

## v0.10.28 - ETF readiness blocked-watchlist clarity

- Bumped site and framework package versions to `0.10.28`.
- Kept `FP-ETF-01` as a conservative gatekeeper, but made its blocked state more useful:
  - blocked representative sectors now remain visible in `top_watchlist` as pending watch items;
  - global blocker readings are now user-facing Chinese text;
  - frontend blocker labels cover sector-level blockers such as missing observed ETF flow and manual valuation/fundamental seeds;
  - frontend readiness values display as percentages instead of decimal fractions.
- Regenerated packaged `etf_decision_readiness.json` and `data_reality_audit.json`.
- Added a regression test so mock-only data still blocks guidance while showing pending watch items.

Boundary:

- This update does not change scoring weights.
- This update does not change provider collection rules.
- A blocked sector remains blocked; it is not a buy candidate.
- The current packaged data still says ETF buy guidance is not ready.

## v0.10.27 - Daily Action publishes ETF readiness

- Bumped site and framework package versions to `0.10.27`.
- Updated `a_share_daily_ci` runner to `a_share_daily_ci_v0_10_27`.
- Added `etf_decision_readiness` to the automated daily CI sequence after
  `sector_module_review`.
- Updated the GitHub daily workflow to publish
  `financial-pond/data/etf_decision_readiness.json`.
- Added workflow and runner tests so the ETF readiness panel cannot silently
  become stale while other daily data updates.

Boundary:

- This update automates publication of the readiness gate.
- It does not change provider collection rules or create trade orders.

## v0.10.26 - ETF readiness progress view

- Bumped site and framework package versions to `0.10.26`.
- Upgraded `FP-ETF-01` from a blocker-only gate to a visible readiness progress view.
- Added `progress` to `etf_decision_readiness.json`:
  - completion ratio;
  - current stage;
  - next unlock;
  - five milestone checks;
  - a short sleep-note summary for the user.
- Added frontend progress bar and milestone checklist inside the ETF行动准备度 panel.
- Updated tests to guard the progress contract.

Boundary:

- This update still does not create buy/sell orders.
- It makes the path to ETF decision support visible, especially while waiting
  for the next trading-day AKShare flow data.

## v0.10.25 - ETF decision readiness gate

- Bumped site and framework package versions to `0.10.25`.
- Added `FP-ETF-01` ETF decision readiness as a gatekeeper between sector rankings and ETF action language.
- Added `npm run etf:readiness`.
- Added `etf_decision_readiness.json` and Markdown output under `model_outputs/<date>/`.
- Added frontend ETF行动准备度 panel.
- Added the readiness layer to `data_reality_audit.json`.
- Added tests for:
  - blocking guidance when sector-flow data is mock-only;
  - keeping AKShare first-day `baseline_only` data out of buyable ETF-flow labels.

Boundary:

- This update does not create buy/sell orders.
- It intentionally blocks ETF guidance when observed ETF flow, sample days, or valuation/fundamental source quality are insufficient.
- It does not fake `estimated_flow` before a second trading date exists.

## v0.10.19 - Rotation trend confirmation layer

- Bumped site and framework package versions to `0.10.19`.
- Upgraded `FP-HIST-01` sector rotation history from simple day-to-day comparison to a trend-confirmation layer.
- Added `trend_confirmations` to `sector_rotation_history.json`.
- Added persistent leader and persistent laggard detection based on consecutive appearance in the daily leader/laggard lists.
- Added conservative trend state:
  - `insufficient_history` before 3 trading-day samples;
  - `history_ready` after enough samples but without persistent signals;
  - `trend_confirmed` only when persistent leaders or laggards have enough consecutive samples.
- Added frontend trend summaries inside the Rotation Intelligence history card.
- Added tests for 3-day persistent leader/laggard confirmation.

Boundary:

- This update does not change daily sector scores.
- Trend confirmation is not a trading instruction.
- The rule confirms continuity of model output, not future price movement.

## v0.10.18 - Data availability convergence

- Bumped site and framework package versions to `0.10.18`.
- Added `data_availability` to `sector_flow_review.json`.
- Added representative-sector ETF-flow coverage, price-volume coverage, mode, headline, and warnings.
- Added `data_availability` passthrough to `sector_rotation_intelligence.json`.
- Added explicit evidence levels for:
  - `etf_flow_ready`;
  - `partial_etf_flow`;
  - `price_volume_only`;
  - `thin_data`.
- Updated the reference dashboard to show an ETF-flow status card.
- Added regression tests for full ETF-flow readiness and price-volume-only fallback days.
- Regenerated packaged web JSON so the local preview includes the new contract.
- Recorded the successful SSH/GitHub push and green GitHub Action path in the current progress registry.

Boundary:

- This update does not change scoring weights.
- Missing ETF share-flow is still not replaced with fake flow.
- The change makes data availability explicit for users and future maintainers.

## v0.10.17 - Daily Action without Worker dependency install

- Bumped site and framework package versions to `0.10.17`.
- Removed the Worker-stage `npm ci` install from `.github/workflows/daily.yml`.
- Kept root build, artifact validation, and root tests in the daily Action.
- Pinned deploy to `npx wrangler@4.102.0 deploy`.
- Added a workflow guard test so the daily Action does not regress to `npm install` or `npm ci`.
- Added `docs/GITHUB_SYNC_PROTOCOL.md` to make GitHub the source-of-truth path explicit.
- Added a current progress registry for this CI stability update.

Boundary:

- This fixes the daily Action install/deploy path only.
- No model logic, provider logic, frontend behavior, or scoring behavior changed.

## v0.10.16 - Daily Action Worker install hardening

- Bumped site and framework package versions to `0.10.16`.
- Changed the GitHub Action Worker build step from `npm install` to `npm ci --no-audit --no-fund`.
- Normalized `package-lock.json` resolved package URLs to the public npm registry so GitHub runners do not depend on an internal workspace registry.
- Added a workflow guard test to prevent the daily Action from regressing to `npm install`.
- Added a current progress registry for the CI install failure fix.

Boundary:

- This fixes the CI install path after A-share collection succeeds.
- No model logic, provider logic, frontend behavior, or scoring behavior changed.

## v0.10.15 - Assistant validation and user action commands

- Bumped site and framework package versions to `0.10.15`.
- Clarified that the assistant must run validation before delivering an update.
- Refined terminal-command discipline so user-facing commands default to downloaded-zip preview, deploy, or next manual action instead of repeated validation.
- Added a current progress registry for this maintenance protocol correction.
- Updated the maintenance doc guard test.

Boundary:

- This is a maintenance protocol update only.
- No model logic, provider logic, frontend behavior, or workflow behavior changed.

## v0.10.14 - Downloaded zip terminal command rule

- Bumped site and framework package versions to `0.10.14`.
- Corrected the terminal-command rule so commands are written for the user's downloaded zip, not the assistant workspace.
- Updated `docs/MAINTENANCE_RULES.md`.
- Updated `docs/UPDATE_PROTOCOL.md`.
- Updated the maintenance doc guard test.

Boundary:

- This is a maintenance protocol update only.
- No model logic, provider logic, frontend behavior, or workflow behavior changed.

## v0.10.13 - Terminal command requirement

- Bumped site and framework package versions to `0.10.13`.
- Added a maintenance rule requiring every GPT update to include copyable terminal commands.
- Added terminal-command discipline to `docs/UPDATE_PROTOCOL.md`.
- Updated the maintenance doc guard test.

Boundary:

- This is a maintenance protocol update only.
- No model logic, provider logic, frontend behavior, or workflow behavior changed.

## v0.10.12 - GitHub Action ordering for 31-industry A-share review

- Bumped site and framework package versions to `0.10.12`.
- Updated `a_share_daily_ci` runner to `a_share_daily_ci_v0_10_12`.
- Added an explicit `graph_cycle` step before `sector_flow_review`.
- Removed the duplicate `npm run cycle -- "$AS_OF"` call from `.github/workflows/daily.yml`.
- Added tests to guard the workflow and runner ordering.

Boundary:

- This update changes CI ordering only.
- Provider coverage remains `11` reviewed representative ETF mappings and `20` framework-only sectors.
- The GitHub Action should publish 31-industry outputs after the next scheduled or manual run.

## v0.10.11 - A-share 31-industry framework expansion

- Bumped site and framework package versions to `0.10.11`.
- Expanded `config/sector_catalog/a_share_industry_etfs.json` from 11 representative sectors to 31 A-share industry framework slots.
- Materialized new pool, asset, node, edge, layer, and report config files for the 20 new framework-only sectors.
- Added `coverage_status` and `classification` metadata to materialized pools, assets, and nodes.
- Added sector-flow counts:
  - `provider_mapped_representative_sectors: 11`;
  - `framework_only_sectors: 20`.
- Updated frontend sector table to show coverage status.
- Regenerated packaged `dashboard.json`, `sector_flow_review.json`, `sector_rotation_intelligence.json`, `sector_rotation_history.json`, and `general_pool_analysis.json`.

Current result:

- A-share sector-flow framework: `31` sectors.
- Provider-mapped representative sectors: `11`.
- Framework-only sectors: `20`.
- General pool analysis: `33` pools, including S&P 500, A-share market, and 31 A-share industry pools.

Boundary:

- The 20 framework-only sectors can run through the model structure, but they must not be treated as real ETF-flow coverage yet.
- Provider work remains focused on the 11 reviewed representative ETF mappings until the additional 20 are reviewed.

## v0.10.10 - A-share first priority alignment

- Bumped site and framework package versions to `0.10.10`.
- Recorded the current A-share availability snapshot.
- Reordered the project plan to prioritize A-share hard-data depth before S&P 500 provider work.
- Kept shared improvements synchronized through `FP-GEN-01`.

Current A-share availability:

- General-model configured input coverage: `100%` for A-share market and 11 A-share industries in the packaged sample.
- Sector-flow review average data completeness: `55%`.
- Sector-flow review average confidence: `22.5%`.
- Direct-flow component coverage: `11/11`.
- Price-volume confirmation coverage: `11/11`.
- News is still fallback in the packaged sample.
- Rotation history has `1` trading-day sample, so trend confirmation is still unavailable.

Boundary:

- The `100%` coverage figure means expected configured inputs are present in the sample graph; it is not decision-grade data quality.
- A-share should be strengthened first. S&P 500 provider ingestion remains next, not abandoned.

## v0.10.9 - Configured general model input contract

- Bumped site and framework package versions to `0.10.9`.
- Added `config/model/general_pool_input_contract.json`.
- Moved general model component channels out of `general_pool_analysis.mjs` and into config.
- Added input profiles for:
  - `us_large_cap_index`;
  - `a_share_market`;
  - `a_share_industry`.
- Added `input_contract_id`, `input_profile`, and `expected_inputs` coverage to `general_pool_analysis.json`.
- Updated tests so S&P 500 can have EPS / valuation inputs while A-share industry pools use their own ETF-flow, price-volume, policy-news, and fundamental-proxy inputs.

Boundary:

- The component language is shared, but concrete inputs are pool-specific.
- Missing inputs lower coverage; they should not be silently replaced by unrelated market inputs.
- News remains pressure/context, not direct capital flow.

## v0.10.8 - General pool analysis for S&P 500 and A-share industries

- Bumped site and framework package versions to `0.10.8`.
- Added `FP-GEN-01` general pool analysis.
- Added `src/tools/general_pool_analysis.mjs`.
- Added `npm run pool:analysis`.
- Added `financial-pond/data/general_pool_analysis.json`.
- The general model now covers:
  - S&P 500;
  - A-share total market;
  - 11 A-share industry pools.
- The shared output contract uses:
  - capital-flow signals;
  - upstream / downstream / peer network influence;
  - price-volume confirmation;
  - news-pressure analysis;
  - fundamental / valuation supplement where configured.
- Wired GitHub Actions and Worker asset embedding to publish `general_pool_analysis.json`.
- Added frontend reference cards for the general model and S&P 500 comparison.
- Added tests for the generator, Worker route, and workflow wiring.
- Updated project plan, module plan, data matrix, and frontend contract.

Boundary:

- This is a shared explainability layer, not a trading instruction.
- S&P 500 analysis is currently based on graph snapshot inputs; live S&P 500 provider ingestion is the next data task.
- A pool may join this model through configuration; core graph code must remain market-agnostic.

## v0.10.7 - Sector rotation history

- Bumped site and framework package versions to `0.10.7`.
- Added `FP-HIST-01` sector rotation history.
- Added `src/tools/sector_rotation_history.mjs`.
- Added `npm run rotation:history`.
- Added `financial-pond/data/sector_rotation_history.json`.
- Added a frontend history-confirmation card in the rotation panel.
- Wired the CI daily runner to generate `sector_rotation_history.json`.
- Wired GitHub Actions and Worker asset embedding to publish the new history JSON.
- Updated GitHub Actions permissions and added a post-test data commit step so published data can persist across scheduled runs.
- Added tests for history generation, Worker route, and workflow wiring.
- Updated project plan, module plan, data matrix, and frontend contract.

Boundary:

- History storage is not a trading instruction.
- One or two samples are not enough for trend confirmation.
- Trend labels should remain tentative until at least the configured minimum sample count is reached.
- Data persistence depends on the GitHub Actions data commit step or a future external storage backend.

## v0.10.6 - Maintenance convergence and module plan

- Bumped site and framework package versions to `0.10.6`.
- Added `docs/MAINTENANCE_RULES.md`.
- Added `docs/UPDATE_PROTOCOL.md`.
- Added `docs/PROJECT_PLAN.md`.
- Added `docs/MODULE_PLAN.md`.
- Added `docs/handbook/CURRENT_PROGRESS_V0_10_6.md`.
- Consolidated the project goal as an extensible financial pond network:
  - capital-flow signals;
  - upstream / downstream / peer influence factors;
  - price-volume analysis;
  - news-pressure analysis.
- Replaced pure numeric module naming with `FP-AREA-Number`.
- Updated data status and frontend contracts for `FP-ROT-01` and `sector_rotation_intelligence.json`.
- Added a source marker to `sector_rotation_intelligence.mjs`.
- Added maintenance documentation guard tests.

Boundary:

- No scoring formula change.
- No new data provider.
- No frontend behavior change beyond documentation alignment.
- Maintenance protocol is now active for future updates.

## v0.10.5 - A-share sector rotation intelligence

- Bumped site and framework package versions to `0.10.5`.
- Added `src/tools/sector_rotation_intelligence.mjs`.
- Added `npm run rotation:review`.
- Added `financial-pond/data/sector_rotation_intelligence.json`.
- Added a frontend `行业轮动情报` panel.
- The new panel translates sector-flow ranking into:
  - leaders;
  - laggards;
  - rotation state;
  - evidence level;
  - style cluster comparison;
  - possible weak-to-strong switching paths;
  - daily watch points.
- Wired the CI daily runner to generate `sector_rotation_intelligence.json` after `sector_flow_review.json`.
- Wired GitHub Actions and Worker asset embedding to publish the new JSON.
- Added tests for the rotation generator, workflow wiring, and Worker JSON route.

Boundary:

- No trading recommendation.
- No scoring formula change.
- No new external data provider.
- News fallback is explicitly surfaced as degraded context.
- Single-day rotation remains a snapshot until multi-day history is added.

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
