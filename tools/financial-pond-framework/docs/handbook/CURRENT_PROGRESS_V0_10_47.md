# Current Progress v0.10.47

## What changed

- Added the Index Explainability / Score Breakdown layer.
- Added `src/core/formula_registry.mjs`.
- The framework now writes `index_explainability.json` and `.md`.
- The website publishes and renders an `指数详情解释` panel.
- `fp:summary` now reports explainability status, explained index count,
  missing explanation count, and top missing explanations.

## Why it matters

- Displayed indexes can now be traced back to source files, source fields, raw
  inputs, formula text, calculation steps, component contributions, data reality
  flags, caveats, and execution boundary.
- The first registry covers provider estimated flow, leaderboard ranks, sector
  flow scores, rotation scores, daily scores and tiers, readiness gates,
  attribution ranks, watchlist states, decision gate statuses, and maturity
  progress.
- If a future UI index lacks a formula entry, the explainability output reports
  `formula_registry_missing` instead of inventing an explanation.

## Boundary

- This is explanation infrastructure.
- It does not unlock ETF execution advice.
- Execution remains blocked by the readiness and gate layers.
