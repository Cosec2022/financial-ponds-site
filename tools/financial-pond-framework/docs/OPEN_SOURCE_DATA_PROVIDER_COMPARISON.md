# Open Source Data Provider Comparison

Version: `0.7.1`

Review date: `2026-07-02`

Purpose: choose open-source data-provider candidates for A-share industry ETF
data and S&P 500 ETF data without coupling the core graph model to any vendor
or Python package.

## Decision

Provider order for the next A-share ETF adapter:

1. `akshare`: primary candidate for A-share ETF quote, turnover, ETF share,
   scale, and public-market reference data.
2. `efinance`: backup candidate for quote history, amount, percent change,
   turnover-style fields, and simple Eastmoney-derived market data.
3. `tushare`: optional structured source when the user provides a token and the
   target endpoint is available.
4. `mootdx`: low-priority quote fallback for Tongdaxin-compatible market data.
5. `qlib`: research and backtest infrastructure candidate, not a first data
   ingestion source.

The project should first build an `akshare_etf_bridge` outside the core model.
That bridge should write local JSON or CSV observations, then the existing
collector layer can read those files.

## Boundary

Open-source provider packages must stay outside `src/core`.

Allowed:

- provider bridge reads external data
- provider bridge writes raw snapshots under `raw_data/`
- provider bridge writes normalized local files under `data/provider_exports/`
- existing collectors convert exports into node observations
- provider health status is reported in `model_outputs/source_status/`

Not allowed:

- importing `akshare`, `efinance`, `tushare`, `mootdx`, or `qlib` from
  `src/core`
- letting a provider directly set pool scores
- hiding provider-specific logic inside graph propagation
- making the dashboard call providers directly

## Comparison Table

| Provider | Role | Strength | Weakness | Default Use |
| --- | --- | --- | --- | --- |
| `akshare` | Primary A-share ETF provider | Broad China-market coverage; ETF spot, history, and ETF share endpoints; no token for many interfaces | Interfaces can change or disappear; data-risk disclaimer; Python dependency | First A-share ETF bridge |
| `efinance` | Quote fallback | Simple API; free open-source Python library; useful K-line fields such as amount, percent change, turnover | Not as complete for ETF share/scale; non-commercial-use statement | Backup quote and amount bridge |
| `tushare` | Optional token provider | Structured China-market data model; wide historical-data orientation | Pro/token dependency; not ideal as default for a standalone zip | Optional source if token is configured |
| `mootdx` | Emergency market-data fallback | Can read Tongdaxin online/offline quote data; MIT license | More quote-reader than ETF-flow provider; environment and source stability need checks | Low-priority fallback |
| `qlib` | Research/backtest platform | Full ML/research/backtest pipeline; strong modular design reference | Not primarily an ETF data source; official dataset availability can change | Future research layer, not ingestion v1 |

## A-share ETF Data Needed

For each A-share industry ETF or representative ETF basket, the first production
bridge should try to produce:

- `trade_date`
- `fund_code`
- `fund_name`
- `close`
- `pct_change`
- `amount`
- `turnover`
- `latest_share`
- `share_change`
- `estimated_aum`
- `source_provider`
- `source_endpoint`
- `provider_run_id`
- `collected_at`

These fields map into model nodes such as:

- `<sector>_etf_flow`
- `<sector>_relative_strength`
- `<sector>_breadth`
- `<sector>_leader_confirmation`

## Provider-Specific Notes

### AKShare

Best first choice for A-share ETF ingestion.

Relevant endpoint families:

- `fund_etf_spot_em`: ETF spot quote and liquidity fields.
- `fund_etf_hist_em`: ETF historical quote data.
- `fund_etf_scale_sse`: Shanghai ETF share data.
- `fund_etf_scale_szse`: Shenzhen ETF share data.
- `fund_scale_daily_szse`: Shenzhen daily ETF scale/share data.

Implementation approach:

```text
akshare_etf_bridge
-> raw_data/provider/akshare/<date>/*.json
-> data/provider_exports/a_share_etf_daily.csv
-> local_csv_collector
-> node observations
```

Risk controls:

- store raw provider output before normalization
- mark stale data if provider date is behind the requested date
- compare quote fields against `efinance` for selected ETFs
- disable the source by config if schema drift is detected

### efinance

Best backup for ETF or index quote history where fields such as price change,
amount, and turnover are enough.

Implementation approach:

```text
efinance_quote_bridge
-> raw_data/provider/efinance/<date>/*.json
-> data/provider_exports/a_share_etf_quote_fallback.csv
-> local_csv_collector
-> node observations
```

Risk controls:

- do not treat efinance as a confirmed ETF share source until tested
- use it mainly for price, amount, and quote-history fallback
- keep non-commercial-use constraints visible in source metadata

### TuShare

Use only when the user provides credentials and the endpoint contract is clear.

Implementation approach:

```text
tushare_bridge
-> requires env token
-> raw_data/provider/tushare/<date>/*.json
-> data/provider_exports/*.csv
```

Risk controls:

- no token in repository or zip
- source remains disabled by default
- adapter must fail closed when token is missing

### mootdx

Use as a market-quote fallback, not as the first ETF flow source.

Implementation approach:

```text
mootdx_quote_bridge
-> quote fallback only
-> compare against primary provider
```

Risk controls:

- treat as lower confidence than official exchange or AKShare ETF share data
- do not use as the sole source for ETF share-change calculations

### Qlib

Qlib is useful as a future research and backtest layer. It should not be used
as the first ingestion source because this project needs explainable daily
observations before ML research infrastructure.

## Current Engineering Step

v0.7.2 creates a Python bridge package under a separate module boundary:

```text
providers/
  akshare_etf_bridge/
    README.md
    export_a_share_etf_daily.py
    provider_contract.json
```

The bridge must not change `src/core`. Its only contract is to export dated
files that the Node.js pipeline can ingest.

Current status:

- fixture export works offline
- real AKShare export path exists
- scheduled scoring still does not enable provider-export collectors by default
- representative ETF codes still require review before production use
