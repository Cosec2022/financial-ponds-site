# Data Ingestion v0.7

This document records the first real-data ingestion layer. The goal is to add
data adapters without weakening the core model boundary.

## Design Boundary

Collectors may fetch or read source data, store raw samples, normalize values,
and emit node observations.

Collectors must not set final pool scores, change graph edges, change portfolio
allocation, or embed market-specific scoring logic in core code.

## Collector Types

### `mock`

Enabled by default. Keeps the project runnable offline and provides
differentiated demo observations for A-share sector ETF pools.

### `http_csv`

Skeleton. Disabled sources by default.

Purpose:

- fetch CSV series from public endpoints such as FRED-style CSV downloads
- normalize them into node observations

Configured examples:

- `fred_us_real_rate_dfii10`
- `fred_vixcls`
- `fred_dgs10`
- `fred_baa10ym`

### `http_json`

Skeleton. Disabled sources by default.

Purpose:

- fetch simple JSON endpoints
- extract numeric values by dot path
- normalize single values into node observations

Configured example:

- `binance_btcusdt_24hr_change` -> `btc_price_momentum`

This is a minimal generic JSON adapter, not a full exchange adapter.

### `local_csv`

Skeleton. Disabled source template by default.

Purpose:

- allow the user or a future data script to place CSV exports in `data/manual/`
- ingest A-share ETF data without immediately depending on fragile webpage
  scraping

Configured template:

- `local_a_share_sector_flow_template`

Expected usage:

```text
data/manual/a_share_sector_flow.csv
```

with columns such as:

```text
date,brokerage_etf_flow,semiconductor_etf_flow,new_energy_ev_etf_flow
```

## Source Status Report

Run:

```bash
npm run sources:status
```

Output:

```text
model_outputs/source_status/source_status.json
```

This report shows total sources, enabled sources, disabled sources, collector
counts, source IDs, and target nodes.

## Current Production Reality

As of v0.8.0:

- mock data is the only enabled hard-data source
- real HTTP CSV sources are configured but disabled
- real HTTP JSON examples are configured but disabled
- local CSV templates are configured but disabled
- news RSS and search sources remain disabled by default
- open-source provider candidates are recorded but disabled by default
- AKShare bridge fixture export exists, but its collector sources remain
  disabled by default
- AKShare bridge validation exists
- AKShare real export failed in the user's first local run because AKShare
  1.18.64 rejected the `symbol` keyword for `fund_etf_scale_sse`
- v0.7.4 adds a provider-bridge retry path for that signature mismatch
- export validation now checks the latest provider run-status file by default
- the user's v0.7.4 local run exposed a missing `compact_date` helper
- v0.7.5 restores `compact_date` and adds fake-AKShare real-path test coverage
- the user's v0.7.5 local run exposed an SSL EOF failure from `fund.szse.cn`
- v0.7.6 treats SSE/SZSE share-scale endpoints as optional enrichment and
  keeps spot quote export alive when they fail
- the user's v0.7.6 macOS run succeeded in real AKShare mode with 11 records
  and `npm run provider:akshare:validate` returned `status: ok`
- v0.7.7 repacks the project without build-time runtime outputs, so validation
  starts from user-created provider files
- v0.7.8 adds a read-only AKShare export inspector that reviews latest exported
  rows and source-level readiness before collector sources are enabled
- v0.7.9 treats the first clean real AKShare run as a row-data baseline when
  ETF-flow columns are empty because no previous local share baseline exists
- v0.8.0 adds efinance and qstock probes plus a provider comparison report, but
  these probes are not model inputs

This is intentional. The system should remain stable offline until each source
is verified and monitored.

## Open-Source Provider Decision

Read:

```text
docs/OPEN_SOURCE_DATA_PROVIDER_COMPARISON.md
config/data_providers/open_source_candidates.json
```

Current provider order:

1. `akshare`: primary A-share ETF provider candidate.
2. `efinance`: fallback for quote history and amount-style fields.
3. `tushare`: optional structured source if a token is available.
4. `mootdx`: low-priority Tongdaxin quote fallback.
5. `qlib`: future research and backtest reference, not ingestion v1.

The next adapter should be a separate provider bridge that writes local CSV or
JSON exports. The Node.js core graph engine should not import these Python
packages.

## Recommended Next Data Steps

1. Review the representative ETF universe in
   `providers/akshare_etf_bridge/provider_contract.json`.
2. Run `npm run provider:akshare:fixture` and inspect provider exports.
3. Run `npm run provider:akshare:validate`.
4. Install AKShare and run a real one-off export from the v0.8.0 package.
5. Run validation again and compare exported values against source pages or
   `efinance`.
6. Run `npm run provider:akshare:inspect`.
7. Run `npm run provider:efinance:probe`.
8. Run `npm run provider:qstock:probe`.
9. Run `npm run providers:compare:a-share-etf`.
10. If validation reports `flow_readiness.status: baseline_only`, wait for a
   later trading date and run the provider again before enabling ETF-flow
   sources.
11. Enable `local_csv` sources one by one only after reviewing the raw exports.
12. Add local CSV sources for sector relative strength.
13. Add FRED CSV sources for US macro and risk nodes.
14. Add dedicated exchange or vendor adapters only after source contracts are
   stable.
10. Add source health checks, retry policy, and stale-data detection.
