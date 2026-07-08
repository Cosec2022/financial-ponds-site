# Current Progress v0.10.48

Date: 2026-07-08

## Summary

v0.10.48 adds the Observation Data Backbone and Workbench UI.

The release preserves daily observation inputs and derived outputs, creates a
generic pool-level observation snapshot, appends observation history, creates
pending review horizons, and makes the workbench the preferred first review
surface on the homepage.

## Added

- `npm run data:vault`
- `npm run observation:snapshot`
- `src/core/observation_schema.mjs`
- `daily_data_vault.json`
- `observation_snapshot.json`
- `manual_review_log.json`
- `outcome_labels.json`
- append-only `observation_history.jsonl`
- homepage `观察工作台`

## Boundary

- The layer is observation-only.
- Boundaries remain `observe_only`, `manual_review`, or `blocked`.
- ETF execution advice remains blocked.
- A-share is the first sample universe, not a core model assumption.

## Remaining Blockers

- valuation/fundamental manual seed
- pool graph snapshot dependency
- rotation visibility low
- execution decision still blocked
