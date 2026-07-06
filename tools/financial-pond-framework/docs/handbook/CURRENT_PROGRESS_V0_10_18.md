# Financial Ponds Site - Current Progress Registry v0.10.18

Date: 2026-07-06

Current package snapshot: `financial-ponds-site-reference-v0.10.18.zip`

## v0.10.18 Change

v0.10.18 converges the data-availability contract after the first successful full GitHub sync and green daily Action.

Live status before this update:

```text
GitHub SSH push path works.
v0.10.17 was pushed to main as commit 6cbe3d9.
Financial Ponds Daily #10 succeeded from commit 6cbe3d9.
The public site published 2026-07-06 A-share data.
```

The main usability issue was interpretation:

```text
ETF flow can be 0/11 when share-change data is unavailable.
Price-volume, water-level, and news inputs may still be available.
The UI must say this explicitly.
```

## Total Progress

Current stage goal:

```text
Run a shared model for S&P 500 and A-share industry analysis.
Prioritize A-share first, then deepen S&P 500 with the same contract.
```

Progress:

```text
Overall: 42%
A-share automation: 58%
A-share model explainability: 66%
A-share provider depth: 34%
S&P 500 provider depth: 18%
Website reference usability: 62%
Maintenance/recovery protocol: 72%
```

## Module Progress

```text
FP-CORE-01 graph engine: working, stable.
FP-AETF-01 A-share sector catalog: 31 slots, 11 representative provider mappings.
FP-FLOW-01 sector flow review: working, now publishes data_availability.
FP-ROT-01 rotation intelligence: working, now carries data_availability and price_volume_only evidence.
FP-HIST-01 rotation history: working, trend requires at least 3 trading days.
FP-GEN-01 general pool analysis: working for S&P 500, A-share market, and A-share industries.
FP-NEWS-01 news pressure: working, but source quality can fall back and must be labeled.
FP-WEB-01 dashboard: working, now separates ETF-flow state from price-volume confirmation.
FP-CI-01 daily GitHub Action: working after v0.10.17 sync.
FP-SYNC-01 GitHub sync protocol: working through SSH key id_ed25519_github.
```

## New Contract

`sector_flow_review.json` now includes:

```text
data_availability.mode
data_availability.headline
data_availability.counts
data_availability.coverage
data_availability.warnings
```

Supported modes:

```text
etf_flow_ready
partial_etf_flow
price_volume_only
thin_data
```

Frontend rule:

```text
If mode is price_volume_only, show "价量可参考，ETF流缺失".
Do not let users read missing ETF share-flow as confirmed capital flow.
```

## Changed Files

```text
package.json
README.md
financial-pond/app.js
financial-pond/data/*.json
tools/financial-pond-framework/package.json
tools/financial-pond-framework/src/tools/sector_flow_review.mjs
tools/financial-pond-framework/src/tools/sector_rotation_intelligence.mjs
tools/financial-pond-framework/tests/akshare_flow_observations.test.mjs
tools/financial-pond-framework/tests/sector_rotation_intelligence.test.mjs
tests/worker.test.mjs
tools/financial-pond-framework/docs/CHANGELOG.md
tools/financial-pond-framework/docs/GITHUB_SYNC_PROTOCOL.md
tools/financial-pond-framework/docs/MODULE_STATUS.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_18.md
```

## Boundary

```text
No scoring weights changed.
No provider endpoint changed.
No fake ETF-flow data was added.
This is a clarity and maintainability update.
```

## Next Work Order

1. Push v0.10.18 through the confirmed SSH path.
2. Run `Financial Ponds Daily` manually once.
3. Confirm the website reference panel shows ETF-flow status.
4. Next data task: improve real ETF share-change continuity so more days become `etf_flow_ready` instead of `price_volume_only`.
