# Current Progress v0.10.36

## Purpose

This version makes the AKShare provider blocker auditable.

The project had already separated two different "need one more day" states:

- sector-rotation history, which needs enough ranked sector snapshots;
- ETF share-change flow, which needs at least two real provider dates for the
  same representative ETF rows.

v0.10.36 adds provider-history metadata so the second state is no longer a
generic waiting message.

## Changed

- `akshare_provider_flow_observations.json` now includes `provider_history`.
- `share_change_diagnostics` now carries the same provider history.
- ETF readiness and daily sector analysis now explain:
  - current provider CSV date;
  - available provider dates;
  - previous available date, if any;
  - whether the blocker is missing history or failed `previous_share` backfill.
- Tests cover baseline-only output when only one provider date exists.

## Boundary

This version does not create fake ETF flow.

`estimated_flow` is still emitted only when the provider export can compute:

```text
latest_share - previous_share
```

No output is a buy, sell, rebalance, or allocation instruction.

## Next Operational Step

Run the real AKShare provider on the next real trading date and then inspect:

```text
akshare_provider_flow_observations.json
share_change_diagnostics.provider_history
share_change_diagnostics.estimated_flow_rows
```

Expected unlock condition:

```text
estimated_flow_rows >= 7 / 11
```

That is the first point where ETF share-change flow can start participating in
decision-readiness gates.
