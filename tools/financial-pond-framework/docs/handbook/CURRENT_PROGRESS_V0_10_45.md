# Current Progress v0.10.45

## What changed

- Added the Sector Watchlist State Machine.
- The framework now writes `sector_watchlist_state.json` and `.md`.
- The website publishes and renders an `观察清单状态` panel.
- `fp:summary` now reports watchlist headline, group counts, key sector groups,
  and the blocked execution reason.

## Why it matters

- Signal Attribution conflicts now become daily review states instead of loose
  notes.
- Rows can be grouped as confirmed watch, conflict review, flow-only candidate,
  rotation-only candidate, deteriorating watch, avoid watch, or blocked
  execution.
- First-run rows are marked `state_change: new`; later versions can compare
  against prior watchlist files.

## Boundary

- This is an observation workflow.
- It does not unlock ETF execution advice.
- It does not output buy/sell/position wording.
