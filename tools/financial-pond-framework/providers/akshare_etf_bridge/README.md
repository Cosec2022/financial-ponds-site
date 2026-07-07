# AKShare ETF Bridge

Version introduced: `0.7.2`

Purpose: export A-share industry ETF data from AKShare into project-local files
that the existing Node.js collectors can read.

This module is intentionally outside `src/core`.

## Boundary

The bridge may:

- call AKShare or generate fixture data
- write raw provider snapshots
- write local CSV exports under `data/provider_exports/`
- write provider run status under `model_outputs/provider_runs/`
- write validation and inspection reports under `model_outputs/`

The bridge must not:

- import or modify graph-engine code
- set final pool scores
- edit node, edge, pool, asset, or portfolio configs during a data run
- write dashboard files directly

## Commands

Offline fixture export:

```bash
npm run provider:akshare:fixture
npm run provider:akshare:validate
```

Real AKShare export after installing Python dependency:

```bash
python3 -m pip install -r providers/requirements.txt
npm run provider:akshare:doctor
npm run provider:akshare
npm run provider:akshare:validate
npm run provider:akshare:inspect
```

Use the endpoint probe only when network access is expected:

```bash
npm run provider:akshare:doctor:probe
```

The real command is disabled by operational convention until provider schema,
ETF code mapping, and source freshness have been checked.

`npm run a-share:daily` and the CI runner call the doctor before the real
provider export. If the environment cannot import AKShare, the run fails before
writing misleading provider CSV data.

## Output Files

```text
raw_data/provider/akshare/<date>/a_share_etf_daily_raw.json
data/provider_exports/a_share_etf_daily.csv
data/provider_exports/a_share_sector_flow.csv
model_outputs/provider_runs/akshare_etf_bridge_<date>.json
model_outputs/provider_validation/akshare_etf_bridge_validation.json
model_outputs/provider_inspection/akshare_etf_bridge_inspection.json
model_outputs/provider_inspection/akshare_etf_bridge_inspection.md
```

`a_share_etf_daily.csv` is row-level ETF data.

`a_share_sector_flow.csv` is a wide, collector-friendly file with columns such
as:

```text
date,brokerage_etf_flow,semiconductor_etf_flow,new_energy_ev_etf_flow
```

CSV writes are keyed upserts:

- `a_share_etf_daily.csv`: keyed by `date + fund_code`
- `a_share_sector_flow.csv`: keyed by `date`

This preserves historical rows for normalization while allowing a same-day run
to replace corrected provider output.

## Data Contract

The bridge reads `provider_contract.json`. That file defines the representative
ETF universe and output columns. A future assistant can replace or extend the
ETF universe without changing the bridge code.

## v0.7.4 Real-Run Notes

AKShare 1.18.64 may expose `fund_etf_scale_sse` without a `symbol` parameter.
The bridge now retries that endpoint without keyword arguments if AKShare raises
an `unexpected keyword argument` error.

Validation checks the latest bridge run-status file by default. This prevents a
failed real run from being hidden by older fixture CSV files.

## v0.7.8 Inspection Notes

`npm run provider:akshare:inspect` reviews the latest exported rows before any
provider-export local CSV source is enabled.

It checks whether representative ETF rows have usable price, amount, share, and
estimated-flow values. It also ranks the latest ETF rows by amount and estimated
flow, then writes both machine-readable JSON and human-readable Markdown.

The inspector is read-only against configuration. It never enables collector
sources and never changes graph-core code.

## v0.7.9 Baseline Notes

A clean first real run may have valid quote rows and latest ETF shares while
`estimated_flow` is still empty. This means the run is a baseline: the bridge
has stored current share values, but it cannot calculate share change until a
later trading date exists in the local CSV history.

Validation reports this as:

```json
{
  "status": "ok",
  "flow_readiness": {
    "status": "baseline_only"
  }
}
```

ETF-flow collector sources should remain disabled in this state.
