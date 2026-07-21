# Current Progress v0.10.74

## Release Focus

Complete `FP-HIST-MKT-01` from live AKShare collection through cumulative history and downstream review.

v0.10.73 removed the fixed Git baseline from historical hydration, but earlier workflows had already discarded daily rows after collection and retained only run-status metadata. v0.10.74 writes a durable normalized daily JSON, validates its complete 11-ETF exact-date contract, upserts it before downstream processing, reapplies it at the archive boundary, and commits it in the workflow.

## Data Chain

```text
AKShare exact-date snapshot
-> data/provider_exports/daily/a_share_etf_daily_<as_of>.json
-> strict identity/source/date/close/amount validation
-> cumulative a_share_etf_daily.csv exact-date upsert
-> candidate price basis
-> outcome review
```

Same-day reruns replace the same `(date, fund_code)` keys deterministically. Rows after `AS_OF`, incomplete representative sets, duplicate codes, invalid mappings, non-AKShare substitutes, and unavailable outputs are rejected without invented records.

## Verified Local Recovery

- Restored 2026-07-16 from the complete 11-row Provider CSV committed in `df35307`, including exact date, ETF identity, OHLCV, endpoint, and collection timestamp.
- Preserved 2026-07-22 from Run #33.
- Did not restore 2026-07-17, 2026-07-20, or 2026-07-21 because only status/derived files remained; they are insufficient to reconstruct complete industry ETF Provider rows.
- Immutable observation snapshots were read for audit and not modified.

## Boundary

```text
observe_only
no fabricated prices or outcomes
no benchmark substitution
no stale/future fallback
```
