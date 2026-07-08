# Current Progress v0.10.42

## What changed

- Fixed Daily Sector Analysis tiering after real-provider baseline scores became
  compressed.
- Persistent leaders now keep their rotation-history score for daily tiering.
- The current flow score is still exposed as `current_flow_score`.

## Why it matters

- A confirmed three-day leader should not disappear from the daily watchlist
  only because the provider is still `baseline_only`.
- The watchlist remains useful while ETF execution language stays blocked.

## Boundary

- No buy/sell/rebalance wording is enabled.
- Real ETF share-change flow is still required before execution guidance can
  unlock.
