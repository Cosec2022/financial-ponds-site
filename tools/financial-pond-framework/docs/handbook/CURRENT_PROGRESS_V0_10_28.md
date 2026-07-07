# Financial Ponds Site - Current Progress Registry v0.10.28

Date: 2026-07-07

Current package snapshot: `financial-ponds-site-reference-v0.10.28.zip`

## v0.10.28 Change

v0.10.28 improves the readability of the ETF decision-readiness gate.

The problem:

```text
When every ETF candidate is correctly blocked, the frontend could show an empty
watchlist. That was technically safe, but not useful for the user trying to see
what still needs to unlock.
```

The solution:

```text
If no actionable ETF candidate exists, top_watchlist now falls back to the best
provider-mapped representative sectors and marks them as blocked pending watch
items.
```

## Total Progress

Current stage goal:

```text
Run a shared model for S&P 500 and A-share industry analysis.
Prioritize A-share first, then deepen S&P 500 with the same contract.
```

Progress:

```text
Overall: 45%
A-share automation: 60%
A-share model explainability: 72%
A-share provider depth: 34%
A-share ETF readiness gate: 36%
A-share trend/history layer: 48%
S&P 500 provider depth: 18%
Website reference usability: 66%
Maintenance/recovery protocol: 75%
```

## Module Progress

```text
FP-CORE-01 graph engine: working, stable.
FP-DATA-01 hard providers: working with fallback; still needs observed ETF share-change history.
FP-FLOW-01 sector flow review: working, publishes source-aware data_availability.
FP-ROT-01 rotation intelligence: working, carries data_availability.
FP-HIST-01 rotation history: working, trend confirmation needs 3+ trading-day samples.
FP-GEN-01 general pool analysis: working for S&P 500, A-share market, and A-share industries.
FP-MOD-01 sector modules: working prototype; valuation/fundamental inputs still use manual seeds.
FP-ETF-01 ETF readiness: working prototype; now shows blocked pending watch items.
FP-NEWS-01 news pressure: working, fallback must remain labeled.
FP-UI-01 dashboard: usable prototype; ETF readiness blockers are easier to read.
FP-CI-01 daily GitHub Action: working and publishes ETF readiness JSON.
FP-MAINT-01 maintenance: updated recovery files for v0.10.28.
```

## New Contract

`etf_decision_readiness.json` behavior:

```text
If actionable rows exist:
  top_watchlist = actionable / near-action rows

If no actionable rows exist:
  top_watchlist = top provider-mapped representative rows, still carrying
  blocked_non_real_source or other blocking action labels
```

Frontend rule:

```text
When guidance_state is not_ready, label the table as pending watch items.
Do not treat blocked rows as buy candidates.
Show readiness_score as a percent, with the raw /100 score underneath.
Translate known blocker ids before display.
```

## Changed Files

```text
package.json
README.md
financial-pond/app.js
financial-pond/data/etf_decision_readiness.json
financial-pond/data/data_reality_audit.json
tools/financial-pond-framework/package.json
tools/financial-pond-framework/src/tools/etf_decision_readiness.mjs
tools/financial-pond-framework/tests/etf_decision_readiness.test.mjs
tools/financial-pond-framework/docs/CHANGELOG.md
tools/financial-pond-framework/docs/PROJECT_PLAN.md
tools/financial-pond-framework/docs/MODULE_PLAN.md
tools/financial-pond-framework/docs/MODULE_STATUS.md
tools/financial-pond-framework/docs/handbook/CURRENT_PROGRESS_V0_10_28.md
tools/financial-pond-framework/PROJECT_STATE.md
```

## Boundary

```text
No scoring weights changed.
No provider endpoint changed.
No blocked sector becomes actionable.
Current packaged guidance_state remains not_ready.
Next real data blocker remains AKShare provider run and observed ETF share-change flow.
```

## Next Work Order

1. Push v0.10.28 to GitHub.
2. Run `Financial Ponds Daily` once.
3. Confirm the site shows ETF readiness pending watch items instead of an empty watchlist.
4. Next data task: run AKShare on the next trading date so baseline ETF shares can become share-change flow.
5. Replace manual valuation/fundamental seeds with provider-backed PE/PB/dividend/ROE data before using allocation labels.
