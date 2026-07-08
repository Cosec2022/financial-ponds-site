# Current Progress v0.10.44

## What changed

- Added the Sector Signal Attribution layer.
- The framework now writes `sector_signal_attribution.json` and `.md`.
- The website publishes and renders an `行业信号归因` panel.
- `fp:summary` now reports attribution headline, conflict count, first conflict,
  and top attribution rows.

## Why it matters

- Daily conclusions, ETF estimated flow rank, rotation labels, module labels,
  and graph scores can now be read together.
- Cross-module disagreements are visible instead of hidden behind a single
  headline.

## Boundary

- This improves explainability and manual review.
- It does not unlock ETF execution advice.
- Rows are labeled `observation_only`, `manual_review_required`, or
  `watch_only`; no buy/sell/position wording is emitted.
