# Current Progress v0.10.37

## Purpose

This version protects the AKShare provider history chain.

The ETF share-change calculation needs committed provider CSV history. If the
daily Action publishes only website JSON and does not persist
`data/provider_exports/*.csv`, later runs can lose the rolling baseline needed
for `previous_share`.

## Changed

The daily workflow now commits:

```text
financial-pond/data/*.json
tools/financial-pond-framework/data/provider_exports/*.csv
tools/financial-pond-framework/model_outputs/provider_runs/akshare_etf_bridge_*.json
tools/financial-pond-framework/model_outputs/provider_validation/akshare_etf_bridge_validation.json
tools/financial-pond-framework/model_outputs/provider_inspection/akshare_etf_bridge_inspection.json
tools/financial-pond-framework/model_outputs/provider_inspection/akshare_etf_bridge_inspection.md
```

## Boundary

This version does not alter market scores.

It only preserves the data needed for the next real provider run to compute:

```text
latest_share - previous_share
```

No output is a buy, sell, rebalance, or allocation instruction.

## Next Operational Check

After the next scheduled or manual provider run, inspect:

```text
share_change_diagnostics.provider_history.available_dates
share_change_diagnostics.estimated_flow_rows
```

Expected result after two real provider dates:

```text
provider_history.available_dates length >= 2
estimated_flow_rows > 0
```
