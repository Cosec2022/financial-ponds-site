# Financial Ponds Current Progress — v0.10.75

## Current release

v0.10.75 turns the existing ranked observation output into a clear Top 10 structural-observation surface. The backend publishes up to ten real eligible industries in model order, and the frontend renders that order directly. It does not change model scores, ranking formulas, sample thresholds, or outcome rules, and it never creates filler rows when fewer than ten observations are valid.

The dashboard adds a Chinese human-readable layer for machine states and uses actual mapping, price-strength, liquidity, continuity, diffusion, overheat, and risk-gate fields to explain each industry. Missing evidence is shown as data insufficient. The first industry is selected by default, and clicking another row switches its technical details, core basis, risk boundary, and next observation conditions.

Brand and layout work includes a reusable vector Financial Ponds logo, a pond-only favicon, an Apple touch icon, a desktop Top 10 table, and mobile observation cards.

## Preserved history

- v0.10.73 fixed cumulative ETF history preservation.
- v0.10.74 fixed the durable daily Provider-to-cumulative-history persistence chain.
- Neither history repair is rewritten or weakened by v0.10.75.

## Boundary

All outputs remain `observe_only`. Top 10 is a relative structural-evidence order, not a buy list, future rise probability, allocation recommendation, or trading instruction.
