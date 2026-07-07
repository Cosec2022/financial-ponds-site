# Current Progress v0.10.40

## What changed

- Added rotation-continuation diagnostics to `daily_sector_analysis`.
- Each priority, confirmation, and avoid row can now explain whether the sector
  is a continuation, reversal, new leader, new laggard, or marginal change.
- The decision ticket keeps the ETF boundary intact while giving stronger
  context for why a sector is being watched.

## Why it matters

- This is useful before the next provider date arrives.
- The model no longer only says "top rank" or "continue confirming"; it explains
  the rotation shape behind the row.
- It improves the human review layer without weakening the real-provider gate.

## Boundary

- No ETF execution language is unlocked.
- The next hard gate remains real provider history with calculable
  `previous_share`, `share_change`, and `estimated_flow`.
