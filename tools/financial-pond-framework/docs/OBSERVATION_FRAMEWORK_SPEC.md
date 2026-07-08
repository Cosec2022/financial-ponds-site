# Observation Framework Spec

## Core Objects

- `Universe`: a market, geography, asset group, theme, or user-defined scope.
- `Pool`: a named object inside a universe.
- `Signal`: one slot in the observation matrix.
- `SignalReality`: source-status label for a signal.
- `VectorForecast`: observed capital-flow vector state.
- `ObservationSnapshot`: daily pool-level record.
- `ManualReviewEntry`: human review entry.
- `OutcomeLabel`: realized review label.
- `ReviewHorizon`: T+1, T+3, T+5, or T+20 check.
- `Boundary`: `observe_only`, `manual_review`, or `blocked`.

## Signal Slots

Every pool always has:

- `flow`
- `price_momentum`
- `liquidity`
- `rotation`
- `news`
- `valuation`
- `fundamental`
- `risk`

Missing modules stay visible as `missing`, `planned`, or
`insufficient_history`. They are not dropped from the row.

## Vector Logic

`F_i` is the available estimated flow for pool `i`.

- positive `F_i`: `inward`
- negative `F_i`: `outward`
- zero or missing `F_i`: `neutral`
- magnitude: rank-normalized absolute flow
- velocity: `null`, status `insufficient_history`
- acceleration: `null`, status `insufficient_history`
- confidence: reality score multiplied by coverage score and gate factor

The vector never contains execution instructions.

## History

`model_outputs/observation_history.jsonl` is append-only. Each run appends one
line per pool and never rewrites previous rows.
