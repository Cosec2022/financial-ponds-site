# Financial Ponds Site

Independent Cloudflare Worker site for `financial-ponds.coseclab.dev`.

## Current status

- Site root shows a reference-first dashboard with general S&P 500 and A-share industry analysis.
- The first screen includes `FP-GEN-01` general pool analysis for S&P 500, A-share market, and A-share industries.
- The first screen now includes A-share sector rotation intelligence: leaders, laggards, style clusters, possible switching paths, and watch points.
- The rotation panel now shows rotation-history sample count and trend-confirmation boundary.
- The first screen separates hard data, fallback news, and prototype signals.
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
6. General Pool Analysis after the graph cycle.

Published web JSON:

```text
financial-pond/data/dashboard.json
financial-pond/data/general_pool_analysis.json
financial-pond/data/sector_flow_review.json
financial-pond/data/sector_rotation_intelligence.json
financial-pond/data/sector_rotation_history.json
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
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_17.md
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
