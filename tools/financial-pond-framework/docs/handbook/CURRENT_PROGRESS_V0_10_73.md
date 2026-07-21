# Current Progress v0.10.73

Checked against package exported at `2026-07-21 23:19:24 HKT`.

## Release Focus

`FP-HIST-MKT-01` exact-date market-input continuity.

The daily workflow collected current ETF rows, then the historical archive step rebuilt `a_share_etf_daily.csv` from a fixed old Git revision. When the exact-date historical endpoint failed, rows accumulated after 2026-07-10 disappeared before `fp:daily` created the published candidate and review files. This kept candidate baselines stale and prevented legitimate T+1/T+3 outcomes from becoming reviewed.

## Changed

- Read the existing cumulative ETF CSV instead of `git show` on a fixed historical commit.
- Preserve only rows with `date <= AS_OF`; future rows are excluded during replay.
- Upsert exact-date historical rows into the preserved series.
- Keep a live current-session row when the historical endpoint is unavailable.
- Record preserved-series row count and latest date in the market-input manifest.
- Add regression coverage for cumulative preservation, same-date upsert, and no-lookahead filtering.
- Synchronize `PROJECT_STATE.md`, `PROJECT_PLAN.md`, and `MODULE_PLAN.md` with the actual v0.10.72/v0.10.73 stage.

## What This Does Not Do

- It does not invent missing historical prices.
- It does not convert unavailable reviews into reviewed outcomes.
- It does not overwrite an existing candidate baseline with a later close.
- It does not change the market model, ranking thresholds, or execution boundary.
- It does not call, commit, push, merge, collect providers, or deploy by itself.

## Expected Effect

Starting with the next successful daily provider run, exact-date ETF history should remain cumulative. Due reviews can become `reviewed` when both the candidate ETF and 510300 have exact baseline and review-date closes. Missing dates remain explicitly unavailable.

## Boundary

```text
observe_only
no fabricated outcomes
no buy/sell/rebalance/allocation instruction
```
