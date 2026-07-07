# Financial Ponds Site - Current Progress Registry v0.10.31

Updated: 2026-07-07

Current package snapshot: `financial-ponds-site-reference-v0.10.31.zip`

## v0.10.31 Change

v0.10.31 adds `FP-DAILY-01` Daily Sector Analysis.

The new layer converts the available nightly outputs into a first-screen human
reading:

```text
sector_flow_review
+ sector_rotation_history
+ sector_module_review
+ etf_decision_readiness
+ data_reality_audit when available
= daily_sector_analysis
```

It produces:

```text
priority_watch
confirm_next
avoid_watch
```

The key boundary is unchanged: if ETF readiness is `not_ready`, strong sectors
remain observation-only.

## New Files

```text
tools/financial-pond-framework/src/tools/daily_sector_analysis.mjs
tools/financial-pond-framework/tests/daily_sector_analysis.test.mjs
financial-pond/data/daily_sector_analysis.json
```

## Updated Files

```text
.github/workflows/daily.yml
financial-pond/index.html
financial-pond/app.js
financial-pond/styles.css
scripts/build-assets.mjs
scripts/validate-published-data.mjs
tests/workflow.test.mjs
tests/worker.test.mjs
package.json
tools/financial-pond-framework/package.json
README.md
tools/financial-pond-framework/docs/CHANGELOG.md
tools/financial-pond-framework/docs/PROJECT_PLAN.md
tools/financial-pond-framework/docs/MODULE_PLAN.md
tools/financial-pond-framework/PROJECT_STATE.md
```

## Published Data Contract

`npm run validate:data` now requires 11 files:

```text
dashboard.json
general_pool_analysis.json
sector_flow_review.json
sector_rotation_intelligence.json
sector_rotation_history.json
sector_module_review.json
etf_decision_readiness.json
data_reality_audit.json
daily_sector_analysis.json
news_review.json
pond_map.json
```

## GitHub Action Change

The daily workflow now runs:

```text
npm run daily:sector-analysis -- --as-of "$AS_OF"
```

after `data:audit`, then copies:

```text
model_outputs/$AS_OF/daily_sector_analysis.json
```

to:

```text
financial-pond/data/daily_sector_analysis.json
```

## Frontend Change

The first screen now contains:

```text
今日行业结论
```

before the reference panel.

It shows:

```text
execution boundary / analysis mode
next unlock
priority watch
confirm next
avoid watch
```

## Tests Run

```text
npm run validate:data
cd tools/financial-pond-framework && npm test
npm run build
npm run validate
npm test
```

Observed result:

```text
framework tests: 66 passed
site tests: 3 passed
build embedded: 14 Financial Ponds assets
published data validation: 11 files
```

## Current Boundary

This version does not change:

```text
provider endpoints
market scores
ETF readiness gate logic
valuation/fundamental source quality
portfolio allocation rules
```

It only adds a safer daily interpretation surface on top of the existing gates.

## Next Work

1. Let the next trading-day Action create ETF share-change flow.
2. Re-check `etf_decision_readiness.gates.provider_flow_readiness`.
3. If true flow coverage becomes positive, improve `daily_sector_analysis` to distinguish continuation, reversal, strengthening, and weakening.
4. Keep ETF action language gated by `etf_decision_readiness`.
