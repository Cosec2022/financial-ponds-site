# AKShare ETF Bridge

Version: `0.9.7`

This document records the first provider bridge for A-share industry ETF data.
It is designed as an external adapter, not as part of the core graph model.

## Purpose

Manual copying is not a workable long-term data workflow. The bridge creates a
repeatable file boundary:

```text
AKShare or fixture
-> providers/akshare_etf_bridge/export_a_share_etf_daily.py
-> raw_data/provider/akshare/<date>/
-> data/provider_exports/
-> local_csv_collector
-> node observations
```

## Commands

Offline fixture:

```bash
npm run provider:akshare:fixture
npm run provider:akshare:validate
```

Real AKShare path:

```bash
python3 -m pip install akshare
npm run provider:akshare
npm run provider:akshare:validate
npm run provider:akshare:inspect
```

Stable daily A-share path:

```bash
npm run a-share:daily
```

This is the preferred daily command after AKShare is installed. It avoids the
historical endpoint and uses the current-day snapshot path that worked on the
user's macOS run.

Historical backfill path:

```bash
npm run provider:akshare:backfill-month -- --end-date 2026-07-02
npm run provider:akshare:validate
npm run provider:akshare:inspect
npm run provider:akshare:to-flow
npm run flow:review -- --as-of 2026-07-02
```

The backfill command tries to write about one month of historical rows into the
same local provider CSV files. It is intended to improve price, turnover,
relative-strength, and heat history quickly.

It does not fabricate ETF net flow. `estimated_flow` is only calculated when
historical ETF share rows are available across dates.

Real backfill can be partial. In the user's 2026-07-02 macOS run, AKShare
returned 5 of 11 representative ETF histories and the remaining history requests
failed at the upstream Eastmoney SSL layer. This is provider coverage failure,
not a graph-model failure.

Status interpretation:

```text
ok      = all representative ETF histories were observed
partial = some histories or flow columns are missing, but readable data exists
error   = structural failure such as missing files, missing columns, or failed run
```

Real mode is not enabled in the scheduled pipeline yet. It should only be used
after endpoint freshness and field schema have been checked.

## Files

- `providers/akshare_etf_bridge/export_a_share_etf_daily.py`
- `providers/akshare_etf_bridge/backfill_a_share_etf_history.py`
- `providers/akshare_etf_bridge/validate_exports.py`
- `providers/akshare_etf_bridge/inspect_exports.py`
- `providers/akshare_etf_bridge/provider_contract.json`
- `providers/akshare_etf_bridge/README.md`
- `data/provider_exports/a_share_etf_daily.csv`
- `data/provider_exports/a_share_sector_flow.csv`
- `model_outputs/provider_runs/akshare_etf_bridge_<date>.json`
- `model_outputs/provider_inspection/akshare_etf_bridge_inspection.json`
- `model_outputs/provider_inspection/akshare_etf_bridge_inspection.md`

CSV writes preserve history:

- `a_share_etf_daily.csv` uses `date + fund_code` as the upsert key.
- `a_share_sector_flow.csv` uses `date` as the upsert key.

This is required because normalization profiles such as `change_zscore` need
more than one date of history.

## Why This Is Separate

The project rule is:

```text
Financial assumptions and data-source behavior must not enter src/core.
```

The bridge is allowed to know about AKShare column names and representative ETF
codes. The graph engine is not.

## Current Limits

- The representative ETF universe is an initial candidate list.
- Real AKShare mode can fail if AKShare is not installed or if endpoint schemas
  change.
- The bridge does not yet calculate sector breadth, leader confirmation, or
  relative strength.
- Collector configs for all 11 provider-export ETF-flow columns are present as
  disabled templates.
- In the v0.7.3 build environment, AKShare was not installed and package
  installation was not available, so real export remains pending.
- v0.7.4 fixes the AKShare 1.18.64 `fund_etf_scale_sse` signature mismatch by
  retrying without the unsupported keyword argument.
- v0.7.4 validation checks the latest provider run-status file by default, so a
  failed real run cannot be hidden by older fixture CSV files.
- v0.7.5 restores the missing `compact_date` helper and adds a fake-AKShare
  real-path test for the no-`symbol` endpoint branch.
- v0.7.6 treats `fund_etf_scale_sse` and `fund_etf_scale_szse` as optional
  enrichment endpoints. If one fails, the bridge records a warning and still
  exports row-level quote data from `fund_etf_spot_em`.
- v0.7.7 changes only release packaging: runtime outputs are excluded from the
  zip so validation starts from user-created provider files.
- v0.7.8 adds `provider:akshare:inspect`, a read-only source-review command
  that checks latest exported values before any local CSV source is enabled.
- v0.7.9 separates row-data validation from ETF-flow readiness. A first clean
  real run can be `status: ok` while `flow_readiness.status` is `baseline_only`.
  ETF-flow sources should remain disabled until a later trading date creates
  share-change history.
- v0.9.5 adds `provider:akshare:backfill-month`. Historical price and turnover
  can be requested for the lookback window. Historical share data is used only
  when AKShare exposes it for the relevant exchange/date. Missing share history
  leaves `share_change` and `estimated_flow` empty by design.
- v0.9.6 marks incomplete real history backfills as `partial`, not `ok`, and the
  release zip now extracts into a top-level `financial-pond-framework/` folder.
- v0.9.7 marks zero-row real history backfills as `no_history_available` instead
  of a hard exception, and adds `npm run a-share:daily`.

## Next Step

After reviewing representative ETF codes, enable one local CSV source at a time,
starting with `brokerage_etf_flow`, then compare output against market pages or
a second provider such as `efinance`.
