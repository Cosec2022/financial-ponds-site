# Current Progress v0.10.41

## What changed

- Daily Sector Analysis rows now show visible rotation labels.
- Labels are rendered from `rotation_diagnostic.label`.
- The UI distinguishes constructive labels, warning labels, and neutral watch
  labels.

## Why it matters

- The user can scan whether a sector is continuing, reversing, newly strong, or
  newly weak without opening raw JSON.
- This keeps progress moving while waiting for the next provider history date.

## Boundary

- No model gate is relaxed.
- No ETF buy/sell/rebalance wording is introduced.
