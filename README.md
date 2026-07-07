# Financial Ponds Site

Independent Cloudflare Worker site for `financial-ponds.coseclab.dev`.

## Current status

- Site root shows a reference-first dashboard with general S&P 500 and A-share industry analysis.
- The first screen starts with `FP-AUDIT-01` data reality audit, so model conclusions are read only after source reality is checked.
- The first screen includes `FP-GEN-01` general pool analysis for S&P 500, A-share market, and A-share industries.
- The first screen now includes A-share sector rotation intelligence: leaders, laggards, style clusters, possible switching paths, and watch points.
- The rotation panel now shows rotation-history sample count, trend-confirmation boundary, and persistent leader/laggard summaries when enough samples exist.
- The first screen now includes independent sector modules for valuation, fundamentals, and flow/price. The final label is a cross-tab, not a blended score.
- The first screen now includes `FP-ETF-01` ETF decision readiness, so sector strength is gated before it can be read as ETF action support.
- The ETF readiness panel now keeps blocked-but-close representative sectors visible as pending watch items, with blockers translated for human reading.
- The first screen now includes a provider status panel for AKShare environment, real provider run, ETF share-flow readiness, trend samples, valuation source, and the next command to run.
- The daily Action now runs a published-data completeness guard, so missing ETF readiness, module review, or data audit JSON fails the build instead of silently deploying partial data.
- The first screen separates hard data, fallback news, and prototype signals.
- The reference panel now shows ETF-flow availability separately from price-volume confirmation, so `0/11` ETF-flow days are clearly marked instead of silently mixed into the score.
- A-share hard-data collection runs in `tools/financial-pond-framework`.
- News intelligence is an independent module and writes separate review files.
- Electricity is currently a watchlist/demo pond. It is visible in the graph UI but is not yet connected to a real A-share industry ETF provider.
- GitHub Actions runs the CI daily runner, then deploys the Worker with Wrangler.

## Project goal

The final goal is an extensible financial pond network.

Any market, sector, asset, theme, or user-defined watchlist can be added as a pond. Each pond is analyzed through:

```text
capital-flow signals
+ upstream / downstream / peer influence factors
+ price-volume analysis
+ news-pressure analysis
= explainable financial state
```

The system explains inflow, outflow, rotation, transmission, relative strength, risk pressure, and data confidence. It does not output trading instructions.

## Daily automation

Workflow: `.github/workflows/daily.yml`

Main model command used by CI:

```bash
cd tools/financial-pond-framework
npm run a-share:daily:ci -- --as-of "$AS_OF"
```

The CI runner collects:

1. A-share sector ETF snapshot.
2. A-share water-level data, with explicit fixture fallback if upstream is unstable.
3. Independent news review, with explicit fixture fallback if news search is unavailable.
4. Sector Flow Review.
5. Sector Rotation Intelligence.
6. Sector Module Review: valuation, fundamentals, and flow/price kept independent.
7. General Pool Analysis after the graph cycle.
8. Data Reality Audit: labels real, mock, fixture, manual seed, and derived layers.

Published web JSON:

```text
financial-pond/data/dashboard.json
financial-pond/data/general_pool_analysis.json
financial-pond/data/sector_flow_review.json
financial-pond/data/sector_rotation_intelligence.json
financial-pond/data/sector_rotation_history.json
financial-pond/data/sector_module_review.json
financial-pond/data/data_reality_audit.json
financial-pond/data/news_review.json
```

## Local test

```bash
npm ci --no-audit --no-fund
npm run build
npm run validate
npm test
```

Model test:

```bash
cd tools/financial-pond-framework
npm test
npm run news:review:fixture -- --as-of 2026-07-02
```

## Deploy

```bash
npm run deploy
```

Required GitHub Secrets for automatic deploy:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

## Boundary

News is expectation pressure. It does not prove flow. Market confirmation still comes from price, turnover, breadth, ETF share change, and other hard data.

## v0.10.6 maintenance convergence

This package consolidates the sustainable-maintenance rules and renames modules to the `FP-AREA-Number` format.

Core maintenance files:

```text
tools/financial-pond-framework/docs/MAINTENANCE_RULES.md
tools/financial-pond-framework/docs/UPDATE_PROTOCOL.md
tools/financial-pond-framework/docs/PROJECT_PLAN.md
tools/financial-pond-framework/docs/MODULE_PLAN.md
tools/financial-pond-framework/docs/GITHUB_SYNC_PROTOCOL.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_30.md
```

Before making meaningful changes, read those files first.

## v0.10.8 general pool analysis

This package adds the shared model surface for the current stage goal:

```text
S&P 500
+ A-share market
+ 11 A-share industry pools
= one explainable pool-analysis contract
```

Working:

```text
- general_pool_analysis.json generation
- shared components: capital_flow, network_influence, price_volume, news_pressure
- configured fundamental_value supplement for pools such as S&P 500
- frontend general-model and S&P 500 comparison cards
- GitHub Actions publishing for the new JSON
```

Boundary:

```text
- S&P 500 is analyzed from graph snapshot inputs in this package.
- Live S&P 500 provider ingestion is not yet enabled.
- The output explains state and does not issue trading instructions.
```

## v0.10.9 configured input contract

This package makes the general model input contract configurable:

```text
Shared components stay common.
Concrete inputs differ by pool profile.
```

Working profiles:

```text
us_large_cap_index -> sp500
a_share_market -> a_share
a_share_industry -> A-share industry pools
```

The general analysis JSON now includes `input_contract_id`, `input_profile`, and `expected_inputs` coverage.

## v0.10.7 sector rotation history

This package starts the multi-day rotation-history layer.

```text
Working:
- sector_rotation_history.json generation
- latest daily rotation snapshot storage
- latest vs previous comparison when history exists
- frontend history-confirmation card
- GitHub Actions published-data persistence attempt
```

The packaged history currently has one day, so trend confirmation remains unavailable until at least three trading-day samples exist.

## v0.10.4 reference dashboard scope

This package is usable as a dashboard prototype and daily publishing pipeline:

```text
Working:
- Cloudflare Worker site
- GitHub Actions deploy
- A-share 31-industry framework review
- 11 provider-mapped representative ETF sectors and 20 framework-only sectors
- top/bottom A-share sector reference panel
- visible data quality and confirmation input labels
- A-share broad water-level provider with CI fallback
- independent news pressure review
- clickable pond map
- local graph node edits and patch export

Not yet live:
- real electricity-sector ETF provider
- adaptive keyword state engine
- adaptive graph backend writeback
- weekly GPT review
- automatic config commit from the frontend
```

Generated runtime outputs under `observations/`, `snapshots/`, `model_outputs/`, and `reports/` are sample state from this package. Treat them as examples, not as permanent source configuration.

## v0.10.5 sector rotation intelligence

This package adds a second interpretation layer on top of `sector_flow_review.json`.

```text
Working:
- sector_rotation_intelligence.json generation
- leaders and laggards
- rotation state classification
- style cluster comparison
- possible weak-to-strong switching paths
- watch points and evidence boundary
- frontend Rotation Intelligence panel
```

## v0.10.20 independent sector modules

This package adds `FP-MOD-01` on top of the existing flow review.

```text
Working:
- config/model/sector_module_profiles.json as editable valuation/fundamental seed input
- sector_module_review.json generation
- independent modules: valuation, fundamental, flow_price
- decision labels such as low valuation but weak fundamentals, fair and improving, or expensive momentum
- frontend Independent Modules panel
- detail and sector table fields for valuation, fundamentals, and cross-tab label
```

## v0.10.28 ETF readiness watchlist clarity

This package improves the already automated `FP-ETF-01` readiness layer.

Working:

```text
- ETF readiness is generated in the daily CI path.
- financial-pond/data/etf_decision_readiness.json is published to the site.
- blocked representative sectors remain visible as pending watch items instead of leaving the watchlist empty.
- blocker readings are user-facing Chinese text.
- frontend blocker labels and readiness percentages are easier to read.
```

## v0.10.29 provider status panel

This package adds a visible operational status layer before the market-reading panels.

Working:

```text
- Provider Status panel reads existing data_reality_audit.json and etf_decision_readiness.json.
- It shows AKShare doctor status, real provider run status, ETF share-flow coverage, trend sample count, and valuation-source state.
- It shows the next command to run from the downloaded zip workspace.
- Worker tests now guard the provider status section and provider audit layers.
```

## v0.10.30 published data completeness guard

This package hardens the daily GitHub Action.

Working:

```text
- scripts/validate-published-data.mjs checks all published web JSON files.
- The daily Action runs npm run validate:data before building the Worker.
- Missing sector_module_review.json, etf_decision_readiness.json, or data_reality_audit.json now fails CI.
- Workflow tests guard the completeness validator and the full decision-data publish list.
```

Boundary:

```text
- No scoring weights changed.
- No provider endpoint changed.
- This update prevents silent partial publish only.
```

Boundary:

```text
- The panel is operational guidance only.
- It does not change model scores.
- It does not change provider collection rules.
- It does not turn blocked ETF rows into buy candidates.
```

Boundary:

```text
- No scoring weights changed.
- No provider endpoint changed.
- No blocked sector becomes a buy candidate.
- The current packaged data still says: not ready for ETF buy guidance.
```

Boundary:

```text
- valuation does not modify flow/price score
- short-term flow does not modify valuation
- manual seed profiles are editable placeholders until live PE/PB/dividend/ROE/earnings data providers are connected
```

## v0.10.21 data reality audit

This package adds `FP-AUDIT-01`.

```text
Working:
- data_reality_audit.json generation
- source classification for flow/price, news, sector modules, rotation, general pool analysis, and rotation history
- frontend Data Reality Audit panel before the reference panel
- reference panel now uses audit status before calling anything hard data
```

Current packaged data reality:

```text
flow_price: mock
news: fixture
sector_modules: manual_seed
sector_rotation: derived_from_non_real
general_pool_analysis: contract_output_source_unverified
rotation_history: derived_from_non_real
```

Boundary:

```text
The model structure is usable, but the current packaged data is not a live market signal.
Read data_reality_audit.json before using any ranking or decision label.
```

## v0.10.22 source-aware flow availability

`sector_flow_review.json` now separates populated components from observed-source evidence.

```text
Added:
- data_availability.source_reality
- data_availability.market_use_confidence
- data_availability.source_counts
- observed-source direct-flow counts
- observed-source price-volume counts
```

If active inputs are mock or fixture only, `data_availability.mode` becomes:

```text
mock_only
```

This prevents a populated mock review from being displayed as `etf_flow_ready`.

## v0.10.23 provider run audit

`data_reality_audit.json` now includes the AKShare real-provider run status.

```text
Layer:
- akshare_provider_run

Possible states:
- provider_run_ok
- provider_run_failed
- provider_not_run
- provider_run_unverified
```

Current local status:

```text
provider_doctor_blocked: No module named 'akshare'
provider_run_failed: AKShare is not installed.
```

This makes the next blocker visible on the dashboard before any model output is read.

## v0.10.24 AKShare provider doctor

The AKShare bridge now has a read-only preflight:

```bash
npm run provider:akshare:doctor
npm run provider:akshare:doctor:probe
```

It writes:

```text
model_outputs/provider_runs/akshare_etf_bridge_doctor.json
```

The CI and `npm run a-share:daily` path run the doctor before real provider export. Current local result:

```text
akshare_import: blocked, No module named 'akshare'
```

The output explains relative sector rotation only. It is not a trading instruction.


## v0.10.2 Adaptive graph feedback

The dashboard now treats upstream/downstream pond nodes as adjustable model parameters. A pond can show proposed node additions, weight reductions, and local manual overrides. Browser-side edits are saved in localStorage and can be exported as a patch JSON before being committed back into model configuration.

The goal is to avoid permanent assumptions such as treating the power sector only as coal power. If news and market confirmation show that grid capex, green power, carbon market, or other nodes have higher explanatory power, the graph can propose node additions or coefficient changes.

## Current progress registry

The project architecture and current module status are recorded in:

```text
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_5.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_6.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_7.md
```

Use the latest current-progress file before editing the project. Module IDs use `FP-AREA-Number`, for example `FP-ROT-01`.

Additional maintenance references:

```text
tools/financial-pond-framework/docs/MAINTENANCE_RULES.md
tools/financial-pond-framework/docs/UPDATE_PROTOCOL.md
tools/financial-pond-framework/docs/PROJECT_PLAN.md
tools/financial-pond-framework/docs/MODULE_PLAN.md
tools/financial-pond-framework/docs/handbook/DATA_STATUS_MATRIX.md
tools/financial-pond-framework/docs/handbook/FRONTEND_MODEL_CONTRACT.md
```
