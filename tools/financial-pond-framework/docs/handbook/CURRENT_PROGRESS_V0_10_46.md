# Current Progress v0.10.46

## What changed

- Added the Decision Gate Ledger / Readiness Explanation layer.
- The framework now writes `decision_gate_ledger.json` and `.md`.
- The website publishes and renders a `决策闸门账本` panel.
- `fp:summary` now reports execution state, gate counts, top blockers,
  next unlock sequence, and whether provider-ready is still execution-blocked.

## Why it matters

- Provider flow can be `flow_ready` while execution language remains blocked.
- The new ledger puts provider run, provider history, estimated-flow coverage,
  true-flow coverage, attribution conflicts, watchlist conflict review,
  valuation/fundamental reality, rotation visibility, graph snapshot dependency,
  data reality, and execution-language safety into one auditable contract.
- This makes the next unblock sequence visible without inspecting multiple JSON
  files by hand.

## Boundary

- This is readiness explanation only.
- It does not unlock ETF execution advice.
- It does not output buy/sell/position wording.
